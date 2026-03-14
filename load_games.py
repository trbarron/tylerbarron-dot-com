#!/usr/bin/env python3
"""
load_games.py

Reads curated_games.json (output of blunder_tagger.py) and loads each game
into Redis or DynamoDB.

For Redis (default):
    Games are stored under the key: blunderWatch:game:{date}

For DynamoDB:
    Games are stored in the blunderWatchGames table with `date` as the
    partition key. Table name defaults to tb-website-remix-production-blunderWatchGames
    or can be overridden via --table or BLUNDER_WATCH_GAMES_TABLE env var.

Games must have their 'date' field set to their intended publication date
(YYYY-MM-DD) before running this script. Edit curated_games.json or pass
--assign-dates to auto-assign sequential dates starting from --start-date.

Usage:
    python load_games.py                                     # reads curated_games.json, writes to Redis
    python load_games.py --backend dynamo                    # writes to DynamoDB
    python load_games.py --backend dynamo --table my-table   # custom table name
    python load_games.py --input my_games.json
    python load_games.py --assign-dates --start-date 2026-04-01
    python load_games.py --list                              # show what's currently loaded
    python load_games.py --delete 2026-04-01                # remove a specific date

Requirements:
    pip install redis python-dotenv        # for Redis backend
    pip install boto3 python-dotenv        # for DynamoDB backend
    REDIS_URL or REDIS_TLS_URL env var (or .env file) for Redis
    AWS credentials configured for DynamoDB
"""

import argparse
import json
import os
import sys
import time
from datetime import date, timedelta
from typing import Optional

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # python-dotenv optional

TTL_90_DAYS = 90 * 24 * 60 * 60


# ---------------------------------------------------------------------------
# Redis backend
# ---------------------------------------------------------------------------

def get_redis_client():
    try:
        import redis as redis_lib
    except ImportError:
        print("ERROR: redis package not found. Run: pip install redis python-dotenv")
        sys.exit(1)

    url = os.environ.get("REDIS_TLS_URL") or os.environ.get("REDIS_URL")
    if not url:
        print("ERROR: Set REDIS_URL or REDIS_TLS_URL in your environment or .env file.")
        sys.exit(1)
    use_ssl = url.startswith("rediss://")
    return redis_lib.from_url(
        url,
        ssl_cert_reqs=None if use_ssl else "required",
        decode_responses=True,
    )


def load_to_redis(games: list, r, dry_run: bool = False) -> None:
    loaded = 0
    skipped = 0
    for game in games:
        game_date = game.get("date")
        if not game_date:
            print(f"  SKIP {game.get('gameId', '?')} — no date set")
            skipped += 1
            continue

        key = f"blunderWatch:game:{game_date}"
        existing = r.exists(key)

        if existing:
            print(f"  SKIP {game.get('gameId', '?')} ({game_date}) — already loaded (use --overwrite to replace)")
            skipped += 1
            continue

        if dry_run:
            print(f"  DRY  {game.get('gameId', '?')} ({game_date}) — {game.get('blunderCount', '?')} blunders")
            loaded += 1
            continue

        r.setex(key, TTL_90_DAYS, json.dumps(game))
        print(f"  OK   {game.get('gameId', '?')} ({game_date}) — {game.get('blunderCount', '?')} blunders  →  {key}")
        loaded += 1

    print(f"\nLoaded: {loaded}  Skipped: {skipped}")


def overwrite_to_redis(games: list, r) -> None:
    for game in games:
        game_date = game.get("date")
        if not game_date:
            print(f"  SKIP {game.get('gameId', '?')} — no date set")
            continue
        key = f"blunderWatch:game:{game_date}"
        r.setex(key, TTL_90_DAYS, json.dumps(game))
        print(f"  SET  {game.get('gameId', '?')} ({game_date}) — {game.get('blunderCount', '?')} blunders")


def list_loaded_games_redis(r) -> None:
    keys = r.keys("blunderWatch:game:*")
    if not keys:
        print("No games currently loaded in Redis.")
        return
    keys.sort()
    print(f"{'Date':<14} {'Game ID':<10} {'Blunders':<10} {'TTL (days)'}")
    print("─" * 50)
    for key in keys:
        raw = r.get(key)
        ttl_sec = r.ttl(key)
        ttl_days = round(ttl_sec / 86400, 1) if ttl_sec > 0 else "no TTL"
        if raw:
            game = json.loads(raw)
            print(f"{game.get('date', '?'):<14} {game.get('gameId', '?'):<10} {game.get('blunderCount', '?'):<10} {ttl_days}")


def delete_game_redis(r, game_date: str) -> None:
    key = f"blunderWatch:game:{game_date}"
    deleted = r.delete(key)
    if deleted:
        print(f"Deleted: {key}")
    else:
        print(f"Key not found: {key}")


# ---------------------------------------------------------------------------
# DynamoDB backend
# ---------------------------------------------------------------------------

def get_dynamo_table(table_name: str):
    try:
        import boto3
    except ImportError:
        print("ERROR: boto3 package not found. Run: pip install boto3")
        sys.exit(1)

    dynamodb = boto3.resource("dynamodb", region_name=os.environ.get("AWS_REGION", "us-west-2"))
    return dynamodb.Table(table_name)


def load_to_dynamo(games: list, table, dry_run: bool = False) -> None:
    loaded = 0
    skipped = 0
    expires_at = int(time.time()) + TTL_90_DAYS

    for game in games:
        game_date = game.get("date")
        if not game_date:
            print(f"  SKIP {game.get('gameId', '?')} — no date set")
            skipped += 1
            continue

        if dry_run:
            print(f"  DRY  {game.get('gameId', '?')} ({game_date}) — {game.get('blunderCount', '?')} blunders")
            loaded += 1
            continue

        # Check for existing item
        response = table.get_item(Key={"date": game_date})
        if "Item" in response:
            print(f"  SKIP {game.get('gameId', '?')} ({game_date}) — already loaded (use --overwrite to replace)")
            skipped += 1
            continue

        item = dict(game)
        item["expiresAt"] = expires_at

        table.put_item(Item=item)
        print(f"  OK   {game.get('gameId', '?')} ({game_date}) — {game.get('blunderCount', '?')} blunders  →  DynamoDB")
        loaded += 1

    print(f"\nLoaded: {loaded}  Skipped: {skipped}")


def overwrite_to_dynamo(games: list, table) -> None:
    expires_at = int(time.time()) + TTL_90_DAYS
    for game in games:
        game_date = game.get("date")
        if not game_date:
            print(f"  SKIP {game.get('gameId', '?')} — no date set")
            continue
        item = dict(game)
        item["expiresAt"] = expires_at
        table.put_item(Item=item)
        print(f"  SET  {game.get('gameId', '?')} ({game_date}) — {game.get('blunderCount', '?')} blunders")


def list_loaded_games_dynamo(table) -> None:
    response = table.scan(ProjectionExpression="gameId, #d, blunderCount",
                          ExpressionAttributeNames={"#d": "date"})
    items = sorted(response.get("Items", []), key=lambda x: x.get("date", ""))
    if not items:
        print(f"No games currently loaded in DynamoDB table: {table.name}")
        return
    print(f"{'Date':<14} {'Game ID':<10} {'Blunders'}")
    print("─" * 40)
    for item in items:
        print(f"{item.get('date', '?'):<14} {item.get('gameId', '?'):<10} {item.get('blunderCount', '?')}")


def delete_game_dynamo(table, game_date: str) -> None:
    response = table.delete_item(Key={"date": game_date}, ReturnValues="ALL_OLD")
    if response.get("Attributes"):
        print(f"Deleted: {game_date} from {table.name}")
    else:
        print(f"Key not found: {game_date} in {table.name}")


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def load_games_from_file(path: str) -> list:
    try:
        with open(path) as f:
            games = json.load(f)
        if not isinstance(games, list):
            print(f"ERROR: {path} must contain a JSON array.")
            sys.exit(1)
        return games
    except FileNotFoundError:
        print(f"ERROR: File not found: {path}")
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"ERROR: Invalid JSON in {path}: {e}")
        sys.exit(1)


def assign_sequential_dates(games: list, start: str) -> list:
    """Assign consecutive dates starting from start to each game."""
    current = date.fromisoformat(start)
    for game in games:
        game["date"] = current.isoformat()
        current += timedelta(days=1)
    return games


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main():
    default_table = os.environ.get(
        "BLUNDER_WATCH_GAMES_TABLE",
        "tb-website-remix-production-blunderWatchGames",
    )

    parser = argparse.ArgumentParser(description="Load Blunder Watch games into Redis or DynamoDB.")
    parser.add_argument("--input", default="curated_games.json", help="Input JSON file (default: curated_games.json)")
    parser.add_argument("--backend", choices=["redis", "dynamo"], default="redis", help="Storage backend (default: redis)")
    parser.add_argument("--table", default=default_table, help=f"DynamoDB table name (default: {default_table})")
    parser.add_argument("--assign-dates", action="store_true", help="Auto-assign sequential dates to games")
    parser.add_argument("--start-date", default=date.today().isoformat(), help="Start date for --assign-dates (YYYY-MM-DD)")
    parser.add_argument("--overwrite", action="store_true", help="Overwrite existing entries")
    parser.add_argument("--dry-run", action="store_true", help="Print what would be loaded without writing")
    parser.add_argument("--list", action="store_true", help="List all games currently loaded")
    parser.add_argument("--delete", metavar="DATE", help="Delete the game for a specific date (YYYY-MM-DD)")
    args = parser.parse_args()

    if args.backend == "redis":
        r = get_redis_client()
        try:
            r.ping()
            print("Redis connection: OK\n")
        except Exception as e:
            print(f"ERROR: Could not connect to Redis: {e}")
            sys.exit(1)

        if args.list:
            list_loaded_games_redis(r)
            return
        if args.delete:
            delete_game_redis(r, args.delete)
            return

        games = load_games_from_file(args.input)
        print(f"Loaded {len(games)} game(s) from {args.input}")
        if args.assign_dates:
            games = assign_sequential_dates(games, args.start_date)
            print(f"Assigned dates starting from {args.start_date}")
        print()
        if args.overwrite:
            overwrite_to_redis(games, r)
        else:
            load_to_redis(games, r, dry_run=args.dry_run)

    else:  # dynamo
        table = get_dynamo_table(args.table)
        print(f"DynamoDB table: {args.table}\n")

        if args.list:
            list_loaded_games_dynamo(table)
            return
        if args.delete:
            delete_game_dynamo(table, args.delete)
            return

        games = load_games_from_file(args.input)
        print(f"Loaded {len(games)} game(s) from {args.input}")
        if args.assign_dates:
            games = assign_sequential_dates(games, args.start_date)
            print(f"Assigned dates starting from {args.start_date}")
        print()
        if args.overwrite:
            overwrite_to_dynamo(games, table)
        else:
            load_to_dynamo(games, table, dry_run=args.dry_run)


if __name__ == "__main__":
    main()

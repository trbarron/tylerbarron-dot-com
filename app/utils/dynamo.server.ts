// DynamoDB DocumentClient singleton for Blunder Watch data storage

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

let client: DynamoDBDocumentClient | null = null;

export function getDynamoClient(): DynamoDBDocumentClient {
  if (!client) {
    const ddb = new DynamoDBClient({
      region: process.env.AWS_REGION || 'us-west-2',
    });
    client = DynamoDBDocumentClient.from(ddb, {
      marshallOptions: { removeUndefinedValues: true },
    });
  }
  return client;
}

// Architect names tables as: {appName}-{arcEnv}-{tableName}
const arcEnv = process.env.ARC_ENV || 'production';
export const GAMES_TABLE = `tb-website-remix-${arcEnv}-blunderWatchGames`;
export const SUBMISSIONS_TABLE = `tb-website-remix-${arcEnv}-blunderWatchSubmissions`;
export const TTL_90_DAYS_S = 90 * 24 * 60 * 60;
export const TTL_7_DAYS_S = 7 * 24 * 60 * 60;

import { describe, expect, it } from "vitest";
import {
  validateAuthor,
  validateBotCode,
  validateBotName,
} from "~/utils/camelUpCup/validation.server";

const GOOD_BOT = `
from playerinterface import PlayerInterface
import random, math
from collections import defaultdict

class MyCamel(PlayerInterface):
    def move(player, g):
        odds = defaultdict(float)
        if random.random() < math.pi / 10:
            return [2, g.camel_colors[0]]
        return [0]
`;

describe("validateBotName", () => {
  it("accepts typical names", () => {
    expect(validateBotName("MyCamel_2")).toBeNull();
    expect(validateBotName("bot")).toBeNull();
  });

  it("rejects bad names", () => {
    expect(validateBotName("ab")).not.toBeNull(); // too short
    expect(validateBotName("1Camel")).not.toBeNull(); // leading digit
    expect(validateBotName("has space")).not.toBeNull();
    expect(validateBotName("x".repeat(25))).not.toBeNull(); // too long
    expect(validateBotName(undefined)).not.toBeNull();
  });
});

describe("validateAuthor", () => {
  it("accepts a normal name and rejects empty/oversized", () => {
    expect(validateAuthor("Tyler")).toBeNull();
    expect(validateAuthor("   ")).not.toBeNull();
    expect(validateAuthor("x".repeat(41))).not.toBeNull();
  });
});

describe("validateBotCode", () => {
  it("accepts a legitimate bot", () => {
    expect(validateBotCode(GOOD_BOT)).toEqual([]);
  });

  it("rejects banned imports", () => {
    expect(validateBotCode("import os\nclass B:\n    def move(p, g):\n        return [0]")
      .join(" ")).toContain("'os'");
    expect(validateBotCode("from subprocess import run\nclass B:\n    def move(p, g):\n        return [0]")
      .join(" ")).toContain("'subprocess'");
  });

  it("rejects comma imports mixing allowed and banned", () => {
    const errors = validateBotCode(
      "import math, socket\nclass B:\n    def move(p, g):\n        return [0]"
    );
    expect(errors.join(" ")).toContain("'socket'");
  });

  it("rejects dangerous calls and dunder access", () => {
    expect(validateBotCode("class B:\n    def move(p, g):\n        return eval('[0]')")
      .length).toBeGreaterThan(0);
    expect(validateBotCode("class B:\n    def move(p, g):\n        return p.__class__")
      .length).toBeGreaterThan(0);
  });

  it("requires a class with a move method", () => {
    expect(validateBotCode("def move(p, g):\n    return [0]").length).toBeGreaterThan(0);
    expect(validateBotCode("class B:\n    pass").length).toBeGreaterThan(0);
  });

  it("rejects empty and oversized files", () => {
    expect(validateBotCode("")).toHaveLength(1);
    expect(validateBotCode("#" + "x".repeat(70 * 1024)).join(" ")).toContain("too large");
  });
});

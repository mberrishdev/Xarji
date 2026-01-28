/**
 * Minimal TUI - Instant style
 */

import chalk from "chalk";
import boxen from "boxen";
import * as readline from "readline";

// Primary color
const primary = chalk.hex("#EA570B");

// Readline
let rl: readline.Interface | null = null;

function getRL(): readline.Interface {
  if (!rl) {
    rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }
  return rl;
}

function ask(text: string): Promise<string> {
  return new Promise((resolve) => {
    getRL().question(text, resolve);
  });
}

export function close(): void {
  if (rl) {
    rl.close();
    rl = null;
  }
}

// Output
export function print(text: string): void {
  process.stdout.write(text);
}

export function println(text: string = ""): void {
  console.log(text);
}

// Sideline style
export function sideline(lines: string[]): void {
  lines.forEach((line, i) => {
    if (i === 0) {
      println(`${chalk.gray("◆")}  ${line}`);
    } else {
      println(`${chalk.gray("│")}  ${line}`);
    }
  });
  println(chalk.gray("└"));
}

// Messages
export function title(text: string): void {
  println();
  println(chalk.bold(text));
}

export function step(n: number, total: number, text: string): void {
  println();
  println(`${chalk.dim(`[${n}/${total}]`)} ${text}`);
}

export function success(text: string): void {
  println(`${chalk.green("✓")} ${text}`);
}

export function error(text: string): void {
  println(`${chalk.red("✗")} ${text}`);
}

export function info(text: string): void {
  println(chalk.dim(text));
}

export function kv(key: string, value: string): void {
  println(`  ${chalk.dim(key + ":")} ${value}`);
}

// Prompts
export async function prompt(text: string, defaultVal?: string): Promise<string> {
  const hint = defaultVal ? chalk.dim(` (${defaultVal})`) : "";
  const input = await ask(`${text}${hint}: `);
  return input.trim() || defaultVal || "";
}

export async function confirm(text: string, defaultYes = true): Promise<boolean> {
  const hint = defaultYes ? chalk.dim(" (Y/n)") : chalk.dim(" (y/N)");
  const input = (await ask(`${text}${hint}: `)).trim().toLowerCase();
  if (input === "") return defaultYes;
  return input === "y" || input === "yes";
}

// Spinner
export async function spinner<T>(text: string, fn: () => Promise<T>): Promise<T> {
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  let i = 0;

  const interval = setInterval(() => {
    print(`\r${primary(frames[i])} ${text}`);
    i = (i + 1) % frames.length;
  }, 80);

  try {
    const result = await fn();
    clearInterval(interval);
    print(`\r${chalk.green("✓")} ${text}\n`);
    return result;
  } catch (err) {
    clearInterval(interval);
    print(`\r${chalk.red("✗")} ${text}\n`);
    throw err;
  }
}

// Box
export function box(content: string, opts?: { title?: string }): void {
  println(
    boxen(content, {
      padding: { left: 1, right: 1 },
      dimBorder: true,
      title: opts?.title,
    })
  );
}

export { chalk, primary };

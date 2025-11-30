import { Browser } from "puppeteer-core";

// Check if we're running in Lambda
const isLambda = !!process.env.AWS_LAMBDA_FUNCTION_NAME;

interface ChromeInstance {
  browser: Browser;
  cleanup: () => Promise<void>;
}

/**
 * Get a Chrome instance for Puppeteer
 * Uses @sparticuz/chromium in Lambda (per Kyle Higginson's article), local Chrome otherwise
 */
export async function getChrome(): Promise<ChromeInstance> {
  let browser: Browser;

  if (isLambda) {
    console.log("🚀 Launching Chrome in Lambda environment...");
    
    // Use @sparticuz/chromium as recommended in the article
    const chromium = require("@sparticuz/chromium");
    const puppeteer = require("puppeteer-core");
    
    // Set Chromium flags for Lambda environment
    await chromium.font(
      "https://raw.githack.com/googlei18n/noto-emoji/master/fonts/NotoColorEmoji.ttf"
    );
    
    browser = await puppeteer.launch({
      args: [
        ...chromium.args,
        "--disable-gpu",
        "--disable-dev-shm-usage",
        "--disable-setuid-sandbox",
        "--no-sandbox",
        "--no-zygote",
        "--single-process",
      ],
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
    });
  } else {
    console.log("🚀 Launching Chrome in local environment...");
    
    // Use local Puppeteer for development
    const puppeteer = require("puppeteer");
    browser = await puppeteer.launch({
      headless: true,
      defaultViewport: { width: 1280, height: 800 },
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    });
  }

  console.log("✅ Chrome launched successfully");

  return {
    browser,
    cleanup: async () => {
      console.log("🧹 Closing Chrome...");
      await browser.close();
      console.log("✅ Chrome closed");
    },
  };
}


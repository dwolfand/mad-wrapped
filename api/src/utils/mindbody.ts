import { Page } from "puppeteer-core";
import fetch from "node-fetch";

const LOGIN_URL =
  "https://clients.mindbodyonline.com/LoginLaunch?studioid=5723578";
const CLIENT_DIRECTORY_URL =
  "https://clients.mindbodyonline.com/asp/adm/adm_clt_lkup.asp";
const SUBSCRIBER_ID = "5723578";
const BASE_API_URL = "https://www.mindbodyapis.com";

interface SearchResult {
  name: string;
  email: string;
  locations: string;
  mcid: string;
  locationCount: number;
  dupontId: string;
  isCrossRegional: boolean;
}

interface ClientData {
  id: string;
  name: string;
  email: string;
  dupontLocationId: string;
  location: string;
}

interface CrossRegionalAssociation {
  clientId: number;
  masterId: number;
  subscriberId: number;
  subscriberName: string;
  subscriberShortName: string;
}

interface Visit {
  visitRefNo: number;
  classType?: string;
  classId?: number;
  className?: string;
  classDate?: string;
  classTime?: string;
  numMins?: number;
  locationName?: string;
  typeName?: string;
  typeId?: number;
  typeGroup?: string;
  typeGroupId?: number;
  typeTaken?: string;
  trainerID?: number;
  trFirstName?: string;
  trLastName?: string;
  signedIn?: boolean;
  cancelled?: boolean;
  missed?: boolean;
  booked?: boolean;
  confirmed?: boolean;
  webScheduler?: boolean;
  pmtRefNo?: number;
  paymentDate?: string;
  creationDateTime?: string;
  value?: number;
  [key: string]: any;
}

// Helper function to add delay
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Extract auth token from network requests
function setupAuthTokenExtraction(page: Page): {
  getToken: () => string | null;
} {
  let authToken: string | null = null;

  page.setRequestInterception(true);

  page.on("request", (request) => {
    const headers = request.headers();
    if (headers["authorization"] && !authToken) {
      authToken = headers["authorization"].replace(/^Bearer\s+/i, "");
      console.log("🔑 Auth token captured from network request");
    }
    request.continue();
  });

  return {
    getToken: () => authToken,
  };
}

async function loginToMindbody(page: Page): Promise<void> {
  const email = process.env.MINDBODY_EMAIL;
  const password = process.env.MINDBODY_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "Missing credentials. Please set MINDBODY_EMAIL and MINDBODY_PASSWORD in environment variables"
    );
  }

  console.log("Navigating to login page...");
  await page.goto(LOGIN_URL, { waitUntil: "networkidle2", timeout: 60000 });

  // Wait for all redirects to complete
  console.log("Waiting for redirects to complete...");
  await delay(3000);

  console.log("Current URL:", page.url());
  console.log("Waiting for login form...");

  // Wait for the username input field
  await page.waitForSelector("#username", { timeout: 30000 });
  await delay(1000);

  console.log("Filling in credentials...");

  // Fill in email
  await page.type("#username", email, { delay: 50 });
  console.log("Email entered");

  // Fill in password
  await page.type("#password", password, { delay: 50 });
  console.log("Password entered");

  console.log("Submitting login form...");
  const submitButton = await page.$('button[type="submit"]');

  if (submitButton) {
    await submitButton.click();

    // Wait for navigation
    console.log("Waiting for navigation and redirects...");
    await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 60000 });

    // Wait for any additional redirects
    await delay(5000);
    console.log("Final URL after login:", page.url());
  } else {
    throw new Error("Could not find Sign In button");
  }

  console.log("✅ Login successful!");
}

async function navigateToClientDirectory(page: Page): Promise<void> {
  console.log("Navigating to client directory...");

  await page.goto(CLIENT_DIRECTORY_URL, {
    waitUntil: "networkidle2",
    timeout: 60000,
  });

  await delay(3000);

  console.log("Current URL:", page.url());
  console.log("✅ Client directory loaded");
}

async function searchByEmail(
  page: Page,
  email: string
): Promise<SearchResult[]> {
  console.log(`\n🔍 Searching for email: ${email}\n`);

  // Select "All MADabolic" from location dropdown
  console.log("Selecting location: All MADabolic...");
  await page.waitForSelector('select[name="optRegion"]', { timeout: 10000 });

  // Check available options
  const options: Array<{ value: string; text?: string }> = await page.evaluate(
    () => {
      const select = document.querySelector(
        'select[name="optRegion"]'
      ) as HTMLSelectElement;
      if (!select) return [];
      return Array.from(select.options).map((opt) => ({
        value: opt.value,
        text: opt.textContent?.trim(),
      }));
    }
  );

  console.log("Available location options:", options);

  // Look for "All MADabolic" option
  const allMadabolicOption = options.find(
    (opt) =>
      opt.text?.toLowerCase().includes("all madabolic") ||
      opt.text?.toLowerCase().includes("all locations")
  );

  if (allMadabolicOption) {
    console.log(
      `Found "All MADabolic" option with value: ${allMadabolicOption.value}`
    );
    await page.select('select[name="optRegion"]', allMadabolicOption.value);
  } else {
    console.log(
      "⚠️  Could not find 'All MADabolic' option, using first option"
    );
    await page.select('select[name="optRegion"]', options[0]?.value || "0");
  }

  console.log("Location selected");
  await delay(1000);

  // Select "Email" from search by dropdown
  console.log("Selecting search by: Email...");
  await page.waitForSelector('select[name="optSearchBy"]', { timeout: 10000 });
  await page.select('select[name="optSearchBy"]', "email");
  console.log("Search by selected: Email");
  await delay(1000);

  // Enter email in search field
  console.log(`Entering email: ${email}...`);
  await page.waitForSelector("#txtClientSearch", { timeout: 10000 });
  await page.click("#txtClientSearch", { clickCount: 3 });
  await page.type("#txtClientSearch", email);
  await delay(500);

  // Click search button
  console.log("Clicking search button...");
  await page.waitForSelector("#btnSearch", { timeout: 10000 });
  await page.click("#btnSearch");

  // Wait for results
  await delay(3000);

  // Extract search results
  const results: SearchResult[] = await page.evaluate(() => {
    interface SearchResultBrowser {
      name: string;
      email: string;
      locations: string;
      mcid: string;
      locationCount: number;
      dupontId: string;
      isCrossRegional: boolean;
    }

    const searchResults: SearchResultBrowser[] = [];
    const resultsTable = document.getElementById("results");

    if (!resultsTable) {
      console.log("No results table found");
      return searchResults;
    }

    // Check if this is a cross-regional master list
    const header = resultsTable.querySelector("thead");
    const isCrossRegional =
      header?.textContent?.includes("CROSS REGIONAL LOOKUP") || false;
    console.log(
      `Result type: ${
        isCrossRegional ? "Cross-Regional Master List" : "Regular Search"
      }`
    );

    const rows = Array.from(resultsTable.querySelectorAll("tbody tr"));
    console.log(`Found ${rows.length} rows in results table`);

    for (const row of rows) {
      const cells = row.querySelectorAll("td");

      if (isCrossRegional) {
        if (cells.length < 5) {
          console.log(`Skipping cross-regional row with ${cells.length} cells`);
          continue;
        }

        const nameCell = cells[1]?.querySelector("a") ? cells[1] : cells[2];
        const nameLink = nameCell?.querySelector("a") as HTMLAnchorElement;
        if (!nameLink) {
          console.log("No name link found in cross-regional row");
          continue;
        }

        const name = nameLink.textContent?.trim().replace(/\s+/g, " ") || "";

        const mcidMatch = nameLink.href.match(/mcid=(\d+)/);
        const mcid = mcidMatch ? mcidMatch[1] : "";

        const email = cells[4]?.textContent?.trim() || "";
        const locations = cells[5]?.textContent?.trim() || "";
        const locationCount = locations.split("MADabolic").length - 1;

        console.log(
          `Cross-regional row: name=${name}, mcid=${mcid}, email=${email}, locations=${locationCount}`
        );

        if (name && mcid && email) {
          searchResults.push({
            name,
            email,
            locations,
            mcid,
            locationCount,
            dupontId: "",
            isCrossRegional: true,
          });
        }
      } else {
        if (cells.length < 7) {
          console.log(`Skipping regular row with ${cells.length} cells`);
          continue;
        }

        const nameCell = cells[2];
        const nameLink = nameCell?.querySelector("a") as HTMLAnchorElement;
        if (!nameLink) {
          console.log("No name link found in regular row");
          continue;
        }

        const name = nameLink.textContent?.trim().replace(/\s+/g, " ") || "";

        const hrefMatch = nameLink.href.match(/\/app\/clients\/(\d+)/);
        const dupontId = hrefMatch ? hrefMatch[1] : "";

        const emailCell = cells[7];
        const emailLink = emailCell?.querySelector('a[href^="mailto:"]');
        const email = (
          emailLink?.textContent ||
          emailCell?.textContent ||
          ""
        ).trim();

        console.log(
          `Regular row: name=${name}, dupontId=${dupontId}, email=${email}`
        );

        if (name && dupontId && email) {
          searchResults.push({
            name,
            email,
            locations: "MADabolic Dupont",
            mcid: dupontId,
            locationCount: 1,
            dupontId,
            isCrossRegional: false,
          });
        }
      }
    }

    return searchResults;
  });

  console.log(`\n✅ Found ${results.length} result(s)\n`);

  results.forEach((result, index) => {
    console.log(`  ${index + 1}. ${result.name}`);
    console.log(`     Email: ${result.email}`);
    console.log(`     Locations: ${result.locationCount}`);
    console.log(`     MCID: ${result.mcid}`);
    console.log("");
  });

  return results;
}

async function getClientFromMasterLink(
  page: Page,
  mcid: string
): Promise<ClientData | null> {
  console.log(`\n🔗 Navigating to master client link (MCID: ${mcid})...\n`);

  const masterUrl = `${CLIENT_DIRECTORY_URL}?mcid=${mcid}`;
  await page.goto(masterUrl, { waitUntil: "networkidle2", timeout: 60000 });
  await delay(3000);

  const currentUrl = page.url();
  console.log(`📍 Redirected to: ${currentUrl}`);

  const dupontIdMatch = currentUrl.match(/\/app\/clients\/(\d+)/);
  if (!dupontIdMatch) {
    console.error("❌ Could not extract Dupont location ID from URL");
    return null;
  }

  const dupontLocationId = dupontIdMatch[1];
  console.log(`✅ Extracted Dupont Location ID: ${dupontLocationId}`);

  const clientData = await page.evaluate((dupId) => {
    const nameElement = document.querySelector("h1, .client-name");
    const name = nameElement?.textContent?.trim() || "";

    const emailElement = document.querySelector('a[href^="mailto:"]');
    const email = emailElement?.textContent?.trim() || "";

    return {
      name,
      email,
      dupontLocationId: dupId,
    };
  }, dupontLocationId);

  if (!clientData.name) {
    console.error("❌ Could not extract client name from page");
    return null;
  }

  console.log(`✅ Client: ${clientData.name}`);
  console.log(`   Email: ${clientData.email}`);
  console.log(`   Dupont ID: ${clientData.dupontLocationId}`);

  return {
    id: dupontLocationId,
    name: clientData.name,
    email: clientData.email,
    dupontLocationId: dupontLocationId,
    location: "MADabolic Dupont",
  };
}

async function fetchCrossRegionalAssociations(
  clientId: string,
  authToken: string
): Promise<CrossRegionalAssociation[]> {
  const url = `${BASE_API_URL}/clients/v1/subscribers/${SUBSCRIBER_ID}/clients/${clientId}/cross-regional-associations`;

  try {
    console.log(
      `  Fetching cross-regional associations for client ${clientId}...`
    );

    const response = await fetch(url, {
      method: "GET",
      headers: {
        accept: "*/*",
        "accept-language": "en-US,en;q=0.9",
        authorization: `Bearer ${authToken}`,
        "content-type": "application/json",
      },
    });

    if (!response.ok) {
      console.error(
        `  ❌ Failed to fetch cross-regional associations: ${response.status} ${response.statusText}`
      );
      return [];
    }

    const data: any = await response.json();
    let associations: any[] = [];
    if (Array.isArray(data)) {
      associations = data;
    } else if (data.data && Array.isArray(data.data)) {
      associations = data.data;
    }

    console.log(
      `  ✅ Found ${associations.length} cross-regional associations`
    );

    if (associations.length > 0) {
      const locationNames = associations
        .map((a: any) => a.subscriberName || a.subscriberId)
        .join(", ");
      console.log(`     Locations: ${locationNames}`);
    }

    return associations;
  } catch (error) {
    console.error(
      `  ❌ Error fetching cross-regional associations:`,
      error instanceof Error ? error.message : error
    );
    return [];
  }
}

async function fetchVisitHistory(
  clientId: string,
  authToken: string,
  crossRegionalSubscriberId?: string,
  crossRegionalClientId?: string
): Promise<Visit[]> {
  const endDate = new Date();
  const startDate = new Date("2010-01-01");

  const formatDate = (date: Date) => {
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const year = date.getFullYear();
    return `${month}%2F${day}%2F${year}`;
  };

  const startDateStr = formatDate(startDate);
  const endDateStr = formatDate(endDate);

  let url: string;
  if (crossRegionalSubscriberId && crossRegionalClientId) {
    url = `${BASE_API_URL}/legacydomain/v1/subscribers/${SUBSCRIBER_ID}/clients/${clientId}/visits?startDate=${startDateStr}&endDate=${endDateStr}&crossRegionalSubscriberId=${crossRegionalSubscriberId}&crossRegionalClientId=${crossRegionalClientId}`;
    console.log(
      `  Fetching visits for client ${clientId} (cross-regional: ${crossRegionalSubscriberId}/${crossRegionalClientId})...`
    );
  } else {
    url = `${BASE_API_URL}/legacydomain/v1/subscribers/${SUBSCRIBER_ID}/clients/${clientId}/visits?startDate=${startDateStr}&endDate=${endDateStr}`;
    console.log(
      `  Fetching visits for client ${clientId} (primary location)...`
    );
  }

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        accept: "*/*",
        "accept-language": "en-US,en;q=0.9",
        authorization: `Bearer ${authToken}`,
        "content-type": "application/json",
      },
    });

    if (!response.ok) {
      console.error(
        `  ❌ Failed to fetch visits: ${response.status} ${response.statusText}`
      );
      return [];
    }

    const data = await response.json();
    const visits = Array.isArray(data) ? data : data.visits || [];

    console.log(`  ✅ Found ${visits.length} visits`);
    return visits;
  } catch (error) {
    console.error(
      `  ❌ Error fetching visits:`,
      error instanceof Error ? error.message : error
    );
    return [];
  }
}

/**
 * Fetch user data by email using Puppeteer
 * Returns client data and visits
 */
export async function fetchUserByEmail(
  page: Page,
  email: string
): Promise<{
  client: ClientData | null;
  visits: Visit[];
  associations: CrossRegionalAssociation[];
  authToken: string | null;
}> {
  try {
    // Set up auth token extraction
    const tokenExtractor = setupAuthTokenExtraction(page);

    // Login
    await loginToMindbody(page);

    // Navigate to client directory
    await navigateToClientDirectory(page);

    // Search by email
    const searchResults = await searchByEmail(page, email);

    if (searchResults.length === 0) {
      console.log("❌ No results found for that email");
      return { client: null, visits: [], associations: [], authToken: null };
    }

    // Select the result with the most locations
    searchResults.sort((a, b) => b.locationCount - a.locationCount);
    const selectedResult = searchResults[0];

    console.log(
      `\n🎯 Selected: ${selectedResult.name} (${selectedResult.locationCount} locations)\n`
    );
    console.log(`   Email: ${selectedResult.email}`);
    console.log(
      `   Type: ${
        selectedResult.isCrossRegional ? "Cross-Regional" : "Regular"
      }`
    );

    let clientData: ClientData;

    if (selectedResult.isCrossRegional) {
      console.log(`   MCID: ${selectedResult.mcid}`);
      console.log(
        `\n🔗 Navigating to master client link to get Dupont ID...\n`
      );

      const resolvedClient = await getClientFromMasterLink(
        page,
        selectedResult.mcid
      );
      if (!resolvedClient) {
        console.error("❌ Failed to resolve Dupont ID from master link");
        return { client: null, visits: [], associations: [], authToken: null };
      }

      // Use the searched email parameter, not what's extracted from the page
      clientData = {
        ...resolvedClient,
        email: email,
        location: "All MADabolic",
        id: resolvedClient.dupontLocationId || resolvedClient.id,
      };
    } else {
      console.log(`   Dupont ID: ${selectedResult.dupontId}\n`);

      // Use the searched email parameter, not what's extracted from the page
      clientData = {
        id: selectedResult.dupontId,
        name: selectedResult.name,
        email: email,
        dupontLocationId: selectedResult.dupontId,
        location: "All MADabolic",
      };
    }

    // Get auth token (should have been captured during navigation)
    await delay(2000);
    let authToken = tokenExtractor.getToken();

    if (!authToken) {
      console.error("❌ No auth token captured");
      return {
        client: clientData,
        visits: [],
        associations: [],
        authToken: null,
      };
    }

    console.log("✅ Auth token captured");

    // Fetch cross-regional associations
    const associations = await fetchCrossRegionalAssociations(
      clientData.dupontLocationId,
      authToken
    );

    await delay(500);

    // Fetch visits from primary location
    const primaryVisits = await fetchVisitHistory(
      clientData.dupontLocationId,
      authToken
    );
    let allVisits = [...primaryVisits];

    await delay(500);

    // Fetch visits from cross-regional locations
    for (const association of associations) {
      if (association.subscriberId.toString() === SUBSCRIBER_ID) {
        console.log(
          `  ⏭️  Skipping primary location: ${association.subscriberName}`
        );
        continue;
      }

      const crossRegionalVisits = await fetchVisitHistory(
        clientData.dupontLocationId,
        authToken,
        association.subscriberId.toString(),
        association.clientId.toString()
      );
      allVisits = [...allVisits, ...crossRegionalVisits];

      await delay(500);
    }

    console.log(`\n✅ Fetched ${allVisits.length} total visits`);

    return {
      client: clientData,
      visits: allVisits,
      associations,
      authToken,
    };
  } catch (error) {
    console.error("❌ Error fetching user by email:", error);
    throw error;
  }
}

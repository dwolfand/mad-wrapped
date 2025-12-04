import { pool } from "./postgres";

export interface ClientData {
  id: string;
  name: string;
  email: string;
  dupontLocationId: string;
  location: string;
}

export interface CrossRegionalAssociation {
  clientId: number;
  masterId: number;
  subscriberId: number;
  subscriberName: string;
  subscriberShortName: string;
}

export interface Visit {
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

/**
 * Save or update client in database
 */
export async function upsertClient(client: ClientData): Promise<void> {
  if (!client.location) {
    throw new Error(
      `Client ${client.id} (${client.name}) is missing location information`
    );
  }

  const query = `
    INSERT INTO clients (id, location, dupont_location_id, name, email)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (id, location) 
    DO UPDATE SET
      dupont_location_id = COALESCE(EXCLUDED.dupont_location_id, clients.dupont_location_id),
      name = EXCLUDED.name,
      email = EXCLUDED.email,
      updated_at = CURRENT_TIMESTAMP;
  `;

  await pool.query(query, [
    client.id,
    client.location,
    client.dupontLocationId || null,
    client.name,
    client.email || null,
  ]);

  console.log(`💾 Saved client: ${client.name} (${client.id})`);
}

/**
 * Save cross-regional associations
 */
export async function upsertCrossRegionalAssociations(
  clientOriginalId: string,
  clientLocation: string,
  associations: CrossRegionalAssociation[]
): Promise<void> {
  for (const assoc of associations) {
    const query = `
      INSERT INTO cross_regional_associations 
        (client_original_id, client_location, cross_regional_client_id, master_id, subscriber_id, subscriber_name, subscriber_short_name)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (client_original_id, client_location, subscriber_id, cross_regional_client_id) 
      DO UPDATE SET
        master_id = EXCLUDED.master_id,
        subscriber_name = EXCLUDED.subscriber_name,
        subscriber_short_name = EXCLUDED.subscriber_short_name;
    `;

    await pool.query(query, [
      clientOriginalId,
      clientLocation,
      assoc.clientId,
      assoc.masterId,
      assoc.subscriberId,
      assoc.subscriberName,
      assoc.subscriberShortName,
    ]);
  }

  console.log(`💾 Saved ${associations.length} cross-regional associations`);
}

/**
 * Save a visit
 */
export async function upsertVisit(
  clientOriginalId: string,
  clientLocation: string,
  visit: Visit
): Promise<void> {
  // Filter out "Cross Region Visit" entries as they will be captured in other region data pulls
  if (visit.typeName === "Cross Region Visit") {
    return; // Skip this visit
  }

  // Map class type ID to name using a simple lookup
  const classTypeMap: { [key: number]: string } = {
    1: "MAD 60",
    2: "MAD 45",
    3: "MAD HIIT",
    // Add more mappings as needed
  };

  const classTypeName =
    visit.typeId && classTypeMap[visit.typeId]
      ? classTypeMap[visit.typeId]
      : visit.typeName || null;

  // Get the client's dupont_location_id
  const clientResult = await pool.query(
    `SELECT dupont_location_id FROM clients WHERE id = $1 AND location = $2`,
    [clientOriginalId, clientLocation]
  );

  if (clientResult.rows.length === 0) {
    throw new Error(
      `Client not found: ${clientOriginalId} at location ${clientLocation}`
    );
  }

  const dupontLocationId = clientResult.rows[0].dupont_location_id;

  if (!dupontLocationId) {
    throw new Error(
      `Client ${clientOriginalId} at ${clientLocation} is missing dupont_location_id`
    );
  }

  const query = `
    INSERT INTO visits (
      client_original_id,
      client_location,
      client_dupont_location_id,
      visit_ref_no,
      class_type,
      class_id,
      class_name,
      class_date,
      class_time,
      num_mins,
      location_name,
      type_name,
      type_id,
      type_group,
      type_group_id,
      type_taken,
      trainer_id,
      trainer_first_name,
      trainer_last_name,
      signed_in,
      cancelled,
      missed,
      booked,
      confirmed,
      web_scheduler,
      payment_ref_no,
      payment_date,
      creation_date_time,
      value
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30)
    ON CONFLICT (client_original_id, client_location, visit_ref_no)
    DO UPDATE SET
      client_dupont_location_id = EXCLUDED.client_dupont_location_id,
      class_type = EXCLUDED.class_type,
      class_id = EXCLUDED.class_id,
      class_name = EXCLUDED.class_name,
      class_date = EXCLUDED.class_date,
      class_time = EXCLUDED.class_time,
      num_mins = EXCLUDED.num_mins,
      location_name = EXCLUDED.location_name,
      type_name = EXCLUDED.type_name,
      type_id = EXCLUDED.type_id,
      type_group = EXCLUDED.type_group,
      type_group_id = EXCLUDED.type_group_id,
      type_taken = EXCLUDED.type_taken,
      trainer_id = EXCLUDED.trainer_id,
      trainer_first_name = EXCLUDED.trainer_first_name,
      trainer_last_name = EXCLUDED.trainer_last_name,
      signed_in = EXCLUDED.signed_in,
      cancelled = EXCLUDED.cancelled,
      missed = EXCLUDED.missed,
      booked = EXCLUDED.booked,
      confirmed = EXCLUDED.confirmed,
      web_scheduler = EXCLUDED.web_scheduler,
      payment_ref_no = EXCLUDED.payment_ref_no,
      payment_date = EXCLUDED.payment_date,
      creation_date_time = EXCLUDED.creation_date_time,
      value = EXCLUDED.value,
      updated_at = CURRENT_TIMESTAMP;
  `;

  await pool.query(query, [
    clientOriginalId,
    clientLocation,
    dupontLocationId,
    visit.visitRefNo,
    classTypeName,
    visit.classId || null,
    visit.className || null,
    visit.classDate || null,
    visit.classTime || null,
    visit.numMins || null,
    visit.locationName || null,
    visit.typeName || null,
    visit.typeId || null,
    visit.typeGroup || null,
    visit.typeGroupId || null,
    visit.typeTaken || null,
    visit.trainerID || null,
    visit.trFirstName || null,
    visit.trLastName || null,
    visit.signedIn || false,
    visit.cancelled || false,
    visit.missed || false,
    visit.booked || false,
    visit.confirmed || false,
    visit.webScheduler || false,
    visit.pmtRefNo || null,
    visit.paymentDate || null,
    visit.creationDateTime || null,
    visit.value || null,
  ]);
}

/**
 * Update last visits fetched timestamp
 */
export async function updateLastVisitsFetchedAt(
  clientOriginalId: string,
  clientLocation: string
): Promise<void> {
  const query = `
    UPDATE clients
    SET last_visits_fetched_at = CURRENT_TIMESTAMP
    WHERE id = $1 AND location = $2;
  `;

  await pool.query(query, [clientOriginalId, clientLocation]);
}

/**
 * Save auth token
 */
export async function saveAuthToken(token: string): Promise<void> {
  const query = `
    INSERT INTO auth_tokens (token, expires_at, notes)
    VALUES ($1, $2, $3);
  `;

  await pool.query(query, [token, null, null]);
  console.log("💾 Saved auth token");
}

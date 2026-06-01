-- Add briefing document content fields + section "not needed" flags
ALTER TABLE engagements
  -- Virtual / logistics
  ADD COLUMN IF NOT EXISTS join_link                  text,
  ADD COLUMN IF NOT EXISTS dial_in_backup             text,
  ADD COLUMN IF NOT EXISTS green_room_time            text,
  ADD COLUMN IF NOT EXISTS go_live_time               text,

  -- In-person / venue
  ADD COLUMN IF NOT EXISTS arrival_time               text,
  ADD COLUMN IF NOT EXISTS venue_maps_link            text,
  ADD COLUMN IF NOT EXISTS venue_special_instructions text,

  -- Travel
  ADD COLUMN IF NOT EXISTS flight_details             text,
  ADD COLUMN IF NOT EXISTS flight_confirmation        text,
  ADD COLUMN IF NOT EXISTS hotel_name                 text,
  ADD COLUMN IF NOT EXISTS hotel_checkin              text,
  ADD COLUMN IF NOT EXISTS hotel_confirmation         text,
  ADD COLUMN IF NOT EXISTS hotel_maps_link            text,
  ADD COLUMN IF NOT EXISTS ground_transport           text,
  ADD COLUMN IF NOT EXISTS drive_time                 text,
  ADD COLUMN IF NOT EXISTS drive_route_link           text,
  ADD COLUMN IF NOT EXISTS parking_details            text,

  -- Prep / context
  ADD COLUMN IF NOT EXISTS purpose                    text,
  ADD COLUMN IF NOT EXISTS audience_description       text,
  ADD COLUMN IF NOT EXISTS moderator_info             text,
  ADD COLUMN IF NOT EXISTS panelist_info              text,
  ADD COLUMN IF NOT EXISTS vip_info                   text,
  ADD COLUMN IF NOT EXISTS dress_code                 text,

  -- Run of show (structured)
  ADD COLUMN IF NOT EXISTS run_of_show                jsonb DEFAULT '[]',

  -- "Not needed" flags — lets Claude/EA opt out whole sections
  ADD COLUMN IF NOT EXISTS travel_not_needed          boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS venue_not_needed           boolean DEFAULT false;

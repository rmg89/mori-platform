-- The client's own signed/countersigned contract can now be uploaded and
-- attached to the contract record (same "materials" storage bucket as
-- incoming_materials file uploads, via /api/upload).
alter table contracts add column if not exists signed_file_url text;
alter table contracts add column if not exists signed_file_name text;

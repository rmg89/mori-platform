-- Contract templates: the legal/business content of a contract PDF (previously
-- one hardcoded function in documents.ts) becomes editable data. Structural
-- elements (header, Program Details table, Project Scope, Authorization
-- signature blocks) stay hardcoded in the renderer -- only the
-- "Compensation and Billing" through "Cancellation Policy" body becomes an
-- ordered list of typed blocks with {{merge_field}} substitution.

create table if not exists contract_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_default boolean not null default false,
  blocks jsonb not null default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table contract_templates disable row level security;
grant all on contract_templates to anon, authenticated, service_role;

-- Seed the current hardcoded content verbatim, so output is unchanged
-- immediately after rollout. The remit-to block moves here from the old
-- structural code using {{business_name}}/{{business_address}} merge fields
-- rather than duplicating the business_profile address as literal text.
insert into contract_templates (name, is_default, blocks)
values (
  'Speaking Agreement',
  true,
  jsonb_build_array(
    jsonb_build_object('type', 'heading', 'text', 'Compensation and Billing', 'rule', true),
    jsonb_build_object('type', 'paragraph', 'text', 'In exchange for the services provided, the Client agrees to compensate the Speaker as follows:'),
    jsonb_build_object('type', 'key_value', 'text', 'SERVICES FEE: {{fee}} (USD)'),
    jsonb_build_object('type', 'paragraph', 'text', 'In the event that there are any sales taxes, admission taxes, user fees, or other charges, taxes, or fees of any kind levied by the jurisdiction where the speaking engagement is to take place, Client shall be wholly responsible for all such taxes and expenses in addition to any other payment due under the terms of this agreement. Notwithstanding the preceding sentence, each party shall be responsible for its own income taxes.'),
    jsonb_build_object('type', 'heading', 'text', 'Book Fee & Logistics:', 'rule', false),
    jsonb_build_object('type', 'paragraph', 'text', 'The Client will purchase 50 copies of Bring Yourself directly from Porchlight Book Company. Books will be shipped to the address provided by Client to Porchlight Book Company.'),
    jsonb_build_object('type', 'key_value', 'text', 'TRAVEL FEE: $ {{travel_fee}} (USD)'),
    jsonb_build_object('type', 'paragraph', 'text', 'Speaker to provide all receipts related to travel to and from the event to Client, no later than ten (10) days after speaking engagement. Speaker to provide a second invoice which includes the total of travel expenditures.'),
    jsonb_build_object('type', 'key_value', 'text', 'TOTAL PROGRAM FEE: {{total_program_fee}}'),
    jsonb_build_object('type', 'line_list', 'items', jsonb_build_array(
      'MT Global Strategies will invoice 100% of the total Program Fee upon contract acceptance.',
      'Your deposit (50% of fee) is due upon approval of the contract.',
      'The remaining balance (50% of fee) is due five (5) days after the event.',
      'The invoice will be billed in full if the event date is less than thirty (30) days from the authorization date.'
    )),
    jsonb_build_object('type', 'key_value', 'emphasis', 'muted', 'text', 'DEPOSIT DUE: {{deposit_due}} (USD)     BALANCE DUE: {{balance_due}} (USD)'),
    jsonb_build_object('type', 'heading', 'text', 'Please remit all payments to:', 'rule', false),
    jsonb_build_object('type', 'line_list', 'items', jsonb_build_array(
      '{{business_name}}',
      '{{business_address}}',
      '*Bank Information for wire transfer can be provided upon request.'
    )),
    jsonb_build_object('type', 'paragraph', 'text', 'Please note, availability is not guaranteed until the contract and deposit have been received. All inquiries into availability and tentative holds for dates are done as a courtesy and are subject to change. Pricing as defined herein is valid for sixty (60) days unless mutually agreed otherwise. All parties agree to keep the terms of this agreement strictly confidential and shall not disclose these terms to any outside parties.'),
    jsonb_build_object('type', 'heading', 'text', 'Speaker Requirements:', 'rule', true),
    jsonb_build_object('type', 'paragraph', 'text', 'As part of the engagement, the Client and Speaker agree to the following terms:'),
    jsonb_build_object('type', 'bullet_list', 'items', jsonb_build_array(
      'Speaker agrees to present to the best of her ability the information and material described herein and in conversations between the parties as well as to coordinate the details of this program with the Client in order to achieve the outcomes that the Client has stated.',
      'The Speaker or Speaker''s Representatives will pre-approve all promotional material and advertising related to the Speaker with reference to the Client''s event. Approvals will be provided within 48 hours and will not be unduly withheld. Promotional materials include, but are not limited to, Speaker''s biography, photographs, speech title, and speech description. Speaker will provide headshot(s) and biography.',
      'No other photographs, information, or materials pertaining to the Speaker may be used without the prior written approval of the Speaker or Speaker''s Representatives.',
      'No videotaping without written consent given by the speaker. If videotaping is to be performed and approved by the speaker, the client agrees to supply a copy of all recorded footage to Speaker within thirty (30) days of event.',
      'Client grants Speaker permission to use Client''s logo on Speaker''s website and to list Client as a customer.'
    )),
    jsonb_build_object('type', 'heading', 'text', 'Technical and Logistical Requirements:', 'rule', true),
    jsonb_build_object('type', 'paragraph', 'text', 'As part of the engagement, the Client and the Speaker agree to the following terms:'),
    jsonb_build_object('type', 'bullet_list', 'items', jsonb_build_array(
      'The Client will manage the technical setup and provide a brief technical walkthrough to address any questions prior to the event.',
      'The Client will make copies of all handouts.',
      'Client will provide the following: One (1) easel or whiteboard, a laptop and a clicker for the advancement of slides, and a wireless microphone (if necessary).',
      'Speaker will provide all materials necessary for the workshop, including slides and handouts, to Client no later than three (3) days prior to the event.',
      'The Client will support the Speaker''s administrative needs for the event, including, but not limited to, distributing handouts and recording participants'' results after the negotiation exercises.'
    )),
    jsonb_build_object('type', 'heading', 'text', 'Cancellation Policy', 'rule', true),
    jsonb_build_object('type', 'paragraph', 'text', 'If the Client changes the event dates, the deposit sum will be retained by the Speaker and applied to future presentations or consulting assignments on Client''s behalf for a period of one year. If the change is made within thirty (30) days of the event date, the Speaker will retain the deposit without refund to the Client.'),
    jsonb_build_object('type', 'paragraph', 'text', 'In the event of cancellation of this Agreement by Speaker due to illness, death in the family, or an unforeseen emergency or travel delay, MT Global Strategies will not have any liability for expenses or losses incurred by Client. However, in such an event, MT Global Strategies agrees to refund to Client any advances or deposits received from the Client.'),
    jsonb_build_object('type', 'paragraph', 'text', 'In addition and notwithstanding any other provision of this agreement, in the event that the performance of any obligation under this agreement by any party to this agreement is prevented due to acts of God, any government restriction, wars, hostilities, civil disturbances, revolutions, strikes, terrorist attacks, lockouts, or any other cause beyond the reasonable control of any party, then such party shall not be responsible to the other parties for failure or delay in performance of its obligations under this agreement. The terms of this clause shall not exempt, but merely suspend, any party from its duty to perform the obligations under this agreement as soon as practicable after a force majeure condition ceases to exist.')
  )
);

-- Which template a document uses, and the frozen content it actually renders
-- from (not a live reference -- editing a template later must not
-- retroactively change wording on a contract someone may have already signed).
alter table contracts add column if not exists template_id uuid references contract_templates(id) on delete set null;
alter table contracts add column if not exists blocks_snapshot jsonb not null default '[]'::jsonb;

-- Backfill existing drafted-origin contracts onto the seeded default template.
update contracts
set template_id = (select id from contract_templates where is_default limit 1),
    blocks_snapshot = (select blocks from contract_templates where is_default limit 1)
where origin = 'drafted';

-- create_contract gains p_template_id -- resolves blocks from
-- contract_templates (given id, or the default if none given) and freezes
-- them into blocks_snapshot atomically with the insert.
drop function if exists create_contract(uuid, text, numeric, jsonb, text, text);

create function create_contract(
  p_engagement_id uuid,
  p_organization text,
  p_amount numeric default null,
  p_snapshot jsonb default '{}'::jsonb,
  p_origin text default 'drafted',
  p_label text default 'Speaking Agreement',
  p_template_id uuid default null
) returns contracts language plpgsql as $$
declare
  v_seq integer;
  v_number text;
  v_row contracts;
  v_template_id uuid;
  v_blocks jsonb;
begin
  v_seq := nextval('contract_number_seq');
  v_number := 'CON-' || lpad(v_seq::text, 4, '0');

  if p_origin = 'drafted' then
    select id, blocks into v_template_id, v_blocks
    from contract_templates
    where id = coalesce(p_template_id, (select id from contract_templates where is_default limit 1))
    limit 1;
  end if;

  insert into contracts (engagement_id, contract_number, sequence_number, organization, amount, snapshot, origin, label, template_id, blocks_snapshot)
  values (p_engagement_id, v_number, v_seq, p_organization, p_amount, p_snapshot, p_origin, p_label, v_template_id, coalesce(v_blocks, '[]'::jsonb))
  returning * into v_row;
  return v_row;
end;
$$;
grant execute on function create_contract to anon, authenticated, service_role;

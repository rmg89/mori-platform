-- Redesign the default "Speaking Agreement" template content to match the
-- plain, letter-like PDF: sentence-case headings and key/value labels, a single
-- (non-contradictory) 50/50 deposit payment schedule, and general-purpose
-- technical requirements (workshop-specific items removed). Structural layout
-- and placeholder omission live in the renderer (src/lib/documents.ts).
--
-- This UPDATEs the existing default template row only. Existing contracts keep
-- their frozen blocks_snapshot, so already-created documents are unaffected;
-- only newly-created contracts pick up this wording.

update contract_templates
set updated_at = now(),
    blocks = jsonb_build_array(
      jsonb_build_object('type', 'heading', 'text', 'Compensation and billing', 'rule', true),
      jsonb_build_object('type', 'paragraph', 'text', 'In exchange for the services provided, the Client agrees to compensate the Speaker as follows:'),
      jsonb_build_object('type', 'key_value', 'text', 'Services fee: {{fee}} (USD)'),
      jsonb_build_object('type', 'paragraph', 'text', 'In the event that there are any sales taxes, admission taxes, user fees, or other charges, taxes, or fees of any kind levied by the jurisdiction where the speaking engagement is to take place, Client shall be wholly responsible for all such taxes and expenses in addition to any other payment due under the terms of this agreement. Notwithstanding the preceding sentence, each party shall be responsible for its own income taxes.'),
      jsonb_build_object('type', 'heading', 'text', 'Book fee & logistics:', 'rule', false),
      jsonb_build_object('type', 'paragraph', 'text', 'The Client will purchase 50 copies of Bring Yourself directly from Porchlight Book Company. Books will be shipped to the address provided by Client to Porchlight Book Company.'),
      jsonb_build_object('type', 'key_value', 'text', 'Travel fee: {{travel_fee}}'),
      jsonb_build_object('type', 'paragraph', 'text', 'Speaker to provide all receipts related to travel to and from the event to Client, no later than ten (10) days after speaking engagement. Speaker to provide a second invoice which includes the total of travel expenditures.'),
      jsonb_build_object('type', 'key_value', 'text', 'Total program fee: {{total_program_fee}}'),
      jsonb_build_object('type', 'line_list', 'items', jsonb_build_array(
        'Your deposit (50% of fee) is due upon approval of the contract.',
        'The remaining balance (50% of fee) is due five (5) days after the event.',
        'The invoice will be billed in full if the event date is less than thirty (30) days from the authorization date.'
      )),
      jsonb_build_object('type', 'key_value', 'emphasis', 'muted', 'text', 'Deposit due: {{deposit_due}} (USD)     Balance due: {{balance_due}} (USD)'),
      jsonb_build_object('type', 'heading', 'text', 'Please remit all payments to:', 'rule', false),
      jsonb_build_object('type', 'line_list', 'items', jsonb_build_array(
        '{{business_name}}',
        '{{business_address}}',
        '*Bank information for wire transfer can be provided upon request.'
      )),
      jsonb_build_object('type', 'paragraph', 'text', 'Please note, availability is not guaranteed until the contract and deposit have been received. All inquiries into availability and tentative holds for dates are done as a courtesy and are subject to change. Pricing as defined herein is valid for sixty (60) days unless mutually agreed otherwise. All parties agree to keep the terms of this agreement strictly confidential and shall not disclose these terms to any outside parties.'),
      jsonb_build_object('type', 'heading', 'text', 'Speaker requirements:', 'rule', true),
      jsonb_build_object('type', 'paragraph', 'text', 'As part of the engagement, the Client and Speaker agree to the following terms:'),
      jsonb_build_object('type', 'bullet_list', 'items', jsonb_build_array(
        'Speaker agrees to present to the best of her ability the information and material described herein and in conversations between the parties as well as to coordinate the details of this program with the Client in order to achieve the outcomes that the Client has stated.',
        'The Speaker or Speaker''s Representatives will pre-approve all promotional material and advertising related to the Speaker with reference to the Client''s event. Approvals will be provided within 48 hours and will not be unduly withheld. Promotional materials include, but are not limited to, Speaker''s biography, photographs, speech title, and speech description. Speaker will provide headshot(s) and biography.',
        'No other photographs, information, or materials pertaining to the Speaker may be used without the prior written approval of the Speaker or Speaker''s Representatives.',
        'No videotaping without written consent given by the speaker. If videotaping is to be performed and approved by the speaker, the client agrees to supply a copy of all recorded footage to Speaker within thirty (30) days of event.',
        'Client grants Speaker permission to use Client''s logo on Speaker''s website and to list Client as a customer.'
      )),
      jsonb_build_object('type', 'heading', 'text', 'Technical and logistical requirements:', 'rule', true),
      jsonb_build_object('type', 'paragraph', 'text', 'As part of the engagement, the Client and the Speaker agree to the following terms:'),
      jsonb_build_object('type', 'bullet_list', 'items', jsonb_build_array(
        'The Client will manage the technical setup and provide a brief technical walkthrough to address any questions prior to the event.',
        'The Client will make copies of any handouts.',
        'Client will provide a laptop and a clicker for the advancement of slides, and a wireless microphone (if necessary).',
        'Speaker will provide all materials necessary for the presentation, including slides and any handouts, to Client no later than three (3) days prior to the event.',
        'The Client will support the Speaker''s administrative needs for the event, including, but not limited to, distributing any handouts to attendees.'
      )),
      jsonb_build_object('type', 'heading', 'text', 'Cancellation policy', 'rule', true),
      jsonb_build_object('type', 'paragraph', 'text', 'If the Client changes the event dates, the deposit sum will be retained by the Speaker and applied to future presentations or consulting assignments on Client''s behalf for a period of one year. If the change is made within thirty (30) days of the event date, the Speaker will retain the deposit without refund to the Client.'),
      jsonb_build_object('type', 'paragraph', 'text', 'In the event of cancellation of this Agreement by Speaker due to illness, death in the family, or an unforeseen emergency or travel delay, MT Global Strategies will not have any liability for expenses or losses incurred by Client. However, in such an event, MT Global Strategies agrees to refund to Client any advances or deposits received from the Client.'),
      jsonb_build_object('type', 'paragraph', 'text', 'In addition and notwithstanding any other provision of this agreement, in the event that the performance of any obligation under this agreement by any party to this agreement is prevented due to acts of God, any government restriction, wars, hostilities, civil disturbances, revolutions, strikes, terrorist attacks, lockouts, or any other cause beyond the reasonable control of any party, then such party shall not be responsible to the other parties for failure or delay in performance of its obligations under this agreement. The terms of this clause shall not exempt, but merely suspend, any party from its duty to perform the obligations under this agreement as soon as practicable after a force majeure condition ceases to exist.')
    )
where is_default = true;

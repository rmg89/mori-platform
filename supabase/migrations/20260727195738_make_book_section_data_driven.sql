-- Make the "Book fee & logistics" section conditional and data-driven.
-- The default template hardcoded it as two blocks (a heading + a "50 copies of
-- Bring Yourself" paragraph) that always rendered. Replace them with a single
-- `book_section` marker block, which the renderer expands from the contract's
-- per-document book-order fields (quantity/title/vendor) and omits entirely
-- when there's no order.
--
-- Surgical, so the surrounding legal text isn't retyped: the two book blocks
-- sit at indices 4 (heading) and 5 (paragraph) as laid down by the prior
-- redesign migration. Remove index 5 then index 4 (higher first so the second
-- index doesn't shift), then insert the marker back at index 4. Guarded so it
-- only runs if those indices are actually the book heading + paragraph — a
-- no-op if the structure has drifted.
--
-- Existing contracts keep their frozen blocks_snapshot (old boilerplate); only
-- new contracts get the data-driven section.

update contract_templates
set updated_at = now(),
    blocks = jsonb_insert(
      (blocks #- '{5}') #- '{4}',
      '{4}',
      jsonb_build_object('type', 'book_section'),
      false
    )
where is_default = true
  and blocks #>> '{4,text}' = 'Book fee & logistics:'
  and blocks #>> '{5,text}' like 'The Client will purchase 50 copies%';

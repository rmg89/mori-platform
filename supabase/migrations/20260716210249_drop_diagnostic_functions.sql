-- Cleanup: these 4 functions were temporary diagnostics for the RLS-enable
-- cutover (2026-07-16) and were granted execute to anon to be callable from
-- outside — leaving them live would let anyone with the public anon key
-- enumerate role attributes and policy definitions. No longer needed now
-- that default-deny is confirmed working.
drop function if exists diagnose_rls_state();
drop function if exists diagnose_rls_state_2();
drop function if exists diagnose_current_role();
drop function if exists diagnose_existing_policies();

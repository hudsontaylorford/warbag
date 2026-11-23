-- Fix: deleting a trip with expenses failed. Deleting the trip cascades to
-- its people and its expenses; the checks that an expense's people still
-- exist ran before the expense rows were gone. Check them when the delete
-- finishes instead. Removing a single person is still refused in code while
-- they're in expenses or payments.
alter table mosey_expense_people alter constraint mosey_expense_people_person_id_fkey deferrable initially deferred;
alter table mosey_expenses alter constraint mosey_expenses_paid_by_fkey deferrable initially deferred;
alter table mosey_payments alter constraint mosey_payments_from_person_fkey deferrable initially deferred;
alter table mosey_payments alter constraint mosey_payments_to_person_fkey deferrable initially deferred;

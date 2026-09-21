# Complete Salary Slips and Report Printing

## Changes
- Finish HR salary slips by adding a bulk print control for the filtered month and a print action on every payroll row.
- Make Report 121 Profit & Loss Account summary print text consistently bold and readable, including totals and outstanding balances.
- Repair the Profit & Loss By Invoice print table so visible columns fit A4 landscape, numeric totals remain aligned, and no values overlap.

## Verification
- Confirm the salary-slip controls compile and open the existing professional slip print view.
- Check Report 121 summary print styling and the By Invoice landscape column/totals layout.
- Confirm the latest preview build succeeds.

## Technical details
- Reuse the existing salary-slip generator and current payroll filters.
- Add report-specific print markers/styles rather than changing on-screen report layouts.
- Correct print column selectors after the hidden Project / Site column so widths and alignment match the actual visible columns.

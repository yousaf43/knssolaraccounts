const ONES = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
const TEENS = ["ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

function convertUnderThousand(n: number): string {
  if (n === 0) return "";
  let result = "";
  const h = Math.floor(n / 100);
  const rem = n % 100;
  if (h > 0) result += ONES[h] + " hundred ";
  if (rem > 0) {
    if (rem < 10) result += ONES[rem];
    else if (rem < 20) result += TEENS[rem - 10];
    else {
      const t = Math.floor(rem / 10);
      const o = rem % 10;
      result += TENS[t];
      if (o > 0) result += "-" + ONES[o];
    }
  }
  return result.trim();
}

function convertWholeNumber(n: number): string {
  if (n === 0) return "zero";

  const crore = Math.floor(n / 10000000);
  const remAfterCrore = n % 10000000;
  const lakh = Math.floor(remAfterCrore / 100000);
  const remAfterLakh = remAfterCrore % 100000;
  const thousand = Math.floor(remAfterLakh / 1000);
  const rem = remAfterLakh % 1000;

  let result = "";
  if (crore > 0) result += convertUnderThousand(crore) + " crore ";
  if (lakh > 0) result += convertUnderThousand(lakh) + " lakh ";
  if (thousand > 0) result += convertUnderThousand(thousand) + " thousand ";
  if (rem > 0) result += convertUnderThousand(rem);

  return result.trim();
}

export function amountToWords(amount: number): string {
  const abs = Math.abs(amount);
  const rupees = Math.floor(abs);
  const paisa = Math.round((abs - rupees) * 100);
  const isNegative = amount < 0;

  let result = isNegative ? "minus " : "";
  result += convertWholeNumber(rupees) + " rupee" + (rupees === 1 ? "" : "s");
  if (paisa > 0) {
    result += " and " + convertWholeNumber(paisa) + " paisa";
  }
  return result;
}

export function formatCompactAmount(amount: number, currency = "Rs"): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";

  if (abs >= 10000000) {
    return `${sign}${currency} ${(abs / 10000000).toFixed(2)} Crore`;
  }
  if (abs >= 100000) {
    return `${sign}${currency} ${(abs / 100000).toFixed(2)} Lac`;
  }
  if (abs >= 1000) {
    return `${sign}${currency} ${abs.toLocaleString("en-PK")}`;
  }
  return `${sign}${currency} ${abs.toFixed(2)}`;
}

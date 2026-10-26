import { describe, expect, it } from "vitest";
import { createCustomerSearch, matchesQuery, tokenize } from "@/lib/search";

const customers = [
  { name: "Ali Khan", company: "Solar Site", address: "Bhakkar | CNIC: 38301-1234567-1" },
  { name: "Ali Khan Junior", address: "CNIC: 38301-7654321-2" },
];
const match = createCustomerSearch(customers);

describe("Customer CNIC search", () => {
  it("finds a customer with or without CNIC separators", () => {
    expect(matchesQuery("3830112345671", customers[0].address)).toBe(true);
    expect(matchesQuery("38301-1234567-1", customers[0].address)).toBe(true);
  });
  it.each(["INV-535", "SO-100", "QUO-100", "RCP-100"])("finds linked sales document %s by CNIC", number => {
    expect(match(tokenize("3830112345671"), number, "Ali Khan")).toBe(true);
    expect(match(tokenize("3830112345671"), number, "Ali Khan Junior")).toBe(false);
  });
  it("finds legacy company labels and combines document and CNIC tokens", () => {
    expect(match(tokenize("SO100 3830112345671"), "SO-100", "Ali Khan [Solar Site]")).toBe(true);
    expect(match(tokenize("SO999 3830112345671"), "SO-100", "Ali Khan [Solar Site]")).toBe(false);
  });
  it("keeps unknown customers searchable without associating other CNICs", () => {
    expect(match(tokenize("unknown"), "Unknown Customer")).toBe(true);
    expect(match(tokenize("3830112345671"), "Unknown Customer")).toBe(false);
  });
});
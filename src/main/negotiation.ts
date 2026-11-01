import type { CatalogProduct, Quote } from '../shared/types';
import { money } from '../shared/types';
export function dollarsToCents(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1_000_000) throw new Error('Enter a valid non-negative dollar amount.');
  const cents = Math.round(value * 100);
  if (!Number.isSafeInteger(cents) || Math.abs(value * 100 - cents) > 0.00001) throw new Error('Prices may have at most two decimal places.');
  return cents;
}
export function originalQuote(p: CatalogProduct, revision = 0): Quote { return {productId:p.id,unitPriceCents:p.originalPriceCents,status:'ORIGINAL',message:'Original price. Available for a simulated order.',revision}; }
export function negotiate(p: CatalogProduct, current: Quote | null, offer?: unknown): Quote {
  const previous = current?.productId === p.id ? current : originalQuote(p);
  if (previous.unitPriceCents < p.minimumPriceCents || previous.unitPriceCents > p.originalPriceCents) throw new Error('Invalid quote. Please select the product again.');
  const revision = previous.revision + 1;
  if (offer !== undefined && offer !== null) {
    const cents = dollarsToCents(offer);
    if (cents < p.minimumPriceCents) return {...previous,revision,status:'REJECTED',offeredCents:cents,message:'That offer cannot be approved. The approved unit price remains ' + money(previous.unitPriceCents) + '.'};
    const price = Math.min(cents, previous.unitPriceCents, p.originalPriceCents);
    return {productId:p.id,unitPriceCents:price,status:'APPROVED',offeredCents:cents,revision,message:'Approved at ' + money(price) + ' per unit.'};
  }
  const step = Math.max(100, Math.round(p.originalPriceCents * 0.05 / 100) * 100);
  const price = Math.min(previous.unitPriceCents, Math.max(p.targetPriceCents, previous.unitPriceCents - step));
  return {productId:p.id,unitPriceCents:price,status:'APPROVED',revision,message:'Approved at ' + money(price) + ' per unit.'};
}
const ones: Record<string,number> = {zero:0,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,sixteen:16,seventeen:17,eighteen:18,nineteen:19,twenty:20,thirty:30,forty:40,fifty:50,sixty:60,seventy:70,eighty:80,ninety:90};
function numberWords(text: string): number | null { let result=0, group=0; const tokens=text.toLowerCase().split(/[\s-]+/).filter(Boolean); if (!tokens.length) return null; for(const word of tokens) { if(word === 'and') continue; if(word in ones) group+=ones[word]; else if(word==='hundred') group=Math.max(1,group)*100; else if(word==='thousand') {result+=Math.max(1,group)*1000; group=0;} else return null; } return result+group; }
export function explicitPrices(text: string): number[] {
  const prices: number[]=[];
  const numeric=/\$\s*(\d+(?:,\d{3})*(?:\.\d{1,2})?)|\b(\d+(?:\.\d{1,2})?)\s*(?:dollars?|usd)\b|\b(?:for|at)\s+(\d+(?:\.\d{1,2})?)\b/gi;
  for(const match of text.matchAll(numeric)) prices.push(dollarsToCents(Number((match[1]||match[2]||match[3]).replace(/,/g,''))));
  const wordToken='(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand)';
  const words=new RegExp('\\b('+wordToken+'(?:[ -](?:and[ -])?'+wordToken+')*)[ -]+dollars?\\b','gi');
  for(const match of text.matchAll(words)) { const amount=numberWords(match[1]); if(amount!==null) prices.push(dollarsToCents(amount)); }
  const afterFor=new RegExp('\\b(?:for|at)[ -]+('+wordToken+'(?:[ -](?:and[ -])?'+wordToken+')*)\\b','gi');
  for(const match of text.matchAll(afterFor)) { const amount=numberWords(match[1]); if(amount!==null) prices.push(dollarsToCents(amount)); }
  return prices;
}
export function validateAcceptance(text: string, priceCents: number, quantity: number) {
  const clean=text.trim().replace(/[\u2018\u2019]/g,"'");
  if (!clean || /\b(?:cents?|euros?|pounds?|yuan)\b|[€£¥]|\?|\b(?:no|not|never|don't|won't|cannot|can't|if|maybe|unless|cancel|decline|hypothetically)\b/i.test(clean) || !/^(?:(?:yes|okay|ok|great|thanks|thank you)[,.! ]+)*(?:deal(?=[,.!]|$)|i(?:'ll| will) take\b|let's (?:proceed|do it)\b|i (?:accept|agree to) (?:the |your |this )?(?:offer|price)\b)/i.test(clean)) throw new Error('Ask the customer to explicitly accept the approved price before creating an order.');
  if (explicitPrices(clean).some(price => price !== priceCents)) throw new Error('The customer mentioned a different price. Confirm the approved unit price again.');
  if (quantity > 1) { const word=Object.keys(ones).find(key=>ones[key]===quantity); const quantityPattern = new RegExp('\\b(?:'+quantity+(word?'|'+word:'')+')\\b','i'); if(!quantityPattern.test(clean)) throw new Error('Confirm the requested quantity with the customer.'); }
}

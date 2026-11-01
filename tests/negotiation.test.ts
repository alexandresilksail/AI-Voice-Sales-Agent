import {describe,it,expect} from 'vitest';
import {catalog,getProduct} from '../src/main/products';
import {negotiate,originalQuote,validateAcceptance,dollarsToCents} from '../src/main/negotiation';
const headphones=getProduct('headphones-001');
describe('Deterministic pricing, independent of model instructions',()=>{
 it('approves $85 and rejects $65 for the $100/$90/$80 product',()=>{const approved=negotiate(headphones,null,85);expect(approved.unitPriceCents).toBe(8500);expect(approved.status).toBe('APPROVED');const rejected=negotiate(headphones,approved,65);expect(rejected.status).toBe('REJECTED');expect(rejected.unitPriceCents).toBe(8500);});
 it('accepts original and exact floor, and caps an excessive offer',()=>{expect(negotiate(headphones,null,100).unitPriceCents).toBe(10000);expect(negotiate(headphones,null,80).unitPriceCents).toBe(8000);expect(negotiate(headphones,null,200).unitPriceCents).toBe(10000);});
 it('starts a general discount at $95 and never discounts past target without an offer',()=>{let q=negotiate(headphones,null);expect(q.unitPriceCents).toBe(9500);for(let n=0;n<50;n++)q=negotiate(headphones,q);expect(q.unitPriceCents).toBe(9000);});
 it('never produces an approved price below any catalog floor over varied offers',()=>{for(const p of catalog){for(let dollars=0;dollars<=1600;dollars+=7.25){const q=negotiate(p,originalQuote(p),dollars);expect(q.unitPriceCents).toBeGreaterThanOrEqual(p.minimumPriceCents);expect(q.unitPriceCents).toBeLessThanOrEqual(p.originalPriceCents);}expect(p.minimumPriceCents).toBe(getProduct(p.id).minimumPriceCents);}});
 it.each([NaN,Infinity,-1,85.001,'85',null,true])('rejects invalid price input %s',value=>{expect(()=>dollarsToCents(value)).toThrow();});
 it('rejects a corrupted quote below the immutable catalog minimum',()=>{expect(()=>negotiate(headphones,{...originalQuote(headphones),unitPriceCents:1},85)).toThrow();expect(Object.isFrozen(headphones)).toBe(true);});
});
describe('Explicit customer acceptance',()=>{
 it.each(["Deal!","I'll take it.","Let's proceed.","I'll take it for $85.","Deal, I'll take it for eighty-five dollars."])('accepts a clear approved agreement: %s',text=>expect(()=>validateAcceptance(text,8500,1)).not.toThrow());
 it.each(["No deal.","I won't take it.","If you can do $65, deal.","Deal?","Maybe I'll take it.","I'll take it for $65.","I'll take it for sixty-five dollars.","What does I'll take it mean.","Deal breaker.","I'll take it for eighty cents."])('rejects ambiguous, rejected, or unapproved agreement: %s',text=>expect(()=>validateAcceptance(text,8500,1)).toThrow());
 it('requires quantity confirmation above one',()=>{expect(()=>validateAcceptance("I'll take it.",8500,2)).toThrow();expect(()=>validateAcceptance("I'll take two at $85.",8500,2)).not.toThrow();});
});

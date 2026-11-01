import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { JsonStore } from './store';
import { catalog, getProduct, publicCatalog, publicProduct } from './products';
import { originalQuote, negotiate, validateAcceptance } from './negotiation';
import type { Order, SalesSnapshot, ToolRequest, ToolResult } from '../shared/types';
function validOrders(value: unknown): value is Order[] {
  return Array.isArray(value) && value.every(o => o && typeof o.id==='string' && typeof o.productId==='string' && typeof o.productName==='string' && o.status==='PENDING' && o.paymentStatus==='UNPAID' && typeof o.createdAt==='string' && typeof o.idempotencyKey==='string' && typeof o.conversationReference==='string' && typeof o.customerTurnId==='string' && o.currency==='USD' && [o.quantity,o.originalUnitPriceCents,o.finalUnitPriceCents,o.totalCents].every(n=>Number.isSafeInteger(n)&&n>0) && o.totalCents===o.quantity*o.finalUnitPriceCents);
}
interface Turn { id: string; ordinal: number; text: string; complete: boolean; }
export class SalesService {
  private store: JsonStore<Order[]>;
  private history: Order[];
  private state: SalesSnapshot = {sessionId:randomUUID(),productId:null,quote:null};
  private turns = new Map<string,Turn>();
  private latest: Turn | null = null;
  private ordinal = 0;
  private results = new Map<string,ToolResult>();
  constructor(directory: string) { this.store=new JsonStore(join(directory,'orders.json'),()=>[],validOrders); this.history=this.store.read(); }
  get notice() { return this.store.notice; }
  snapshot(): SalesSnapshot { return structuredClone(this.state); }
  orders(): Order[] { return structuredClone(this.history).reverse(); }
  assertSession(id: string) { if (id!==this.state.sessionId) throw new Error('This conversation has ended. Start a new conversation.'); }
  start(productId?: string) { this.state={sessionId:randomUUID(),productId:null,quote:null}; this.turns.clear();this.latest=null;this.ordinal=0;this.results.clear(); if(productId) this.select(productId);return this.snapshot(); }
  end(id: string) { this.assertSession(id); this.latest=null;this.turns.clear(); }
  select(id: string) { const p=getProduct(id); if(this.state.productId!==id) {this.state.productId=id;this.state.quote=originalQuote(p);}return this.snapshot(); }
  begin(sessionId: string, id: string) { this.assertSession(sessionId); if(typeof id!=='string'||id.length>200)throw new Error('Invalid conversation turn.'); if(this.turns.has(id))return; const turn={id,ordinal:++this.ordinal,text:'',complete:false};this.turns.set(id,turn);this.latest=turn; }
  complete(sessionId: string, id: string, text: string) { this.assertSession(sessionId); if(typeof text!=='string'||text.length>20000)throw new Error('Invalid customer transcript.'); if(!this.turns.has(id))this.begin(sessionId,id);const turn=this.turns.get(id)!;turn.text=text;turn.complete=true; }
  offer(id: string, dollars?: unknown) { const p=getProduct(id); this.select(id);this.state.quote=negotiate(p,this.state.quote,dollars);return this.snapshot(); }
  manualOffer(id: string, dollars: unknown) { this.latest=null; return this.offer(id,dollars); }
  manualAccept(id: string, quantity: number) { if(this.state.productId!==id||!this.state.quote)throw new Error('Select and approve this product first.'); if(this.state.quote.status==='REJECTED')throw new Error('The last offer was rejected. Check or accept an approved price first.');const turnId=['manual',this.state.sessionId,id,this.state.quote.revision,quantity].join('-');this.begin(this.state.sessionId,turnId);this.complete(this.state.sessionId,turnId,"Deal! I'll take "+quantity+' at $'+(this.state.quote.unitPriceCents/100).toFixed(2));return this.prepare(id,quantity,turnId); }
  private prepare(id: string, quantity: number, turnId: string | null): Order {
    const p=getProduct(id); const quote=this.state.quote;
    if(this.state.productId!==id||!quote||quote.productId!==id)throw new Error('Show the selected product and its approved price first.');
    if(!Number.isInteger(quantity)||quantity<1||quantity>100)throw new Error('Quantity must be between 1 and 100.');
    if(quote.unitPriceCents<p.minimumPriceCents||quote.unitPriceCents>p.originalPriceCents)throw new Error('The price failed local validation. No order was created.');
    if(!turnId||!this.latest||this.latest.id!==turnId||!this.latest.complete)throw new Error('Wait for the customer transcript and ask for explicit acceptance.');
    validateAcceptance(this.latest.text,quote.unitPriceCents,quantity);
    const key=[this.state.sessionId,turnId,id,quote.unitPriceCents,quantity].join(':');
    const existing=this.history.find(o=>o.idempotencyKey===key);if(existing)return structuredClone(existing);
    const now=new Date();const prefix='ORD-'+now.getFullYear()+String(now.getMonth()+1).padStart(2,'0')+String(now.getDate()).padStart(2,'0')+'-';
    const sequence=Math.max(0,...this.history.filter(o=>o.id.startsWith(prefix)).map(o=>Number(o.id.slice(prefix.length))).filter(Number.isFinite))+1;
    const order: Order={id:prefix+String(sequence).padStart(3,'0'),productId:p.id,productName:p.name,quantity,originalUnitPriceCents:p.originalPriceCents,finalUnitPriceCents:quote.unitPriceCents,totalCents:quote.unitPriceCents*quantity,currency:p.currency,createdAt:now.toISOString(),conversationReference:this.state.sessionId,customerTurnId:turnId,status:'PENDING',paymentStatus:'UNPAID',idempotencyKey:key};
    const next=[...this.history,order];this.store.write(next);this.history=next;return structuredClone(order);
  }
  tool(request: ToolRequest): ToolResult {
    this.assertSession(request.sessionId);
    if(typeof request.callId!=='string'||request.callId.length>200)throw new Error('Invalid tool call.');
    const cached=this.results.get(request.callId);if(cached)return structuredClone(cached);
    if(request.turnId && this.latest?.id!==request.turnId)throw new Error('That customer turn was superseded. Listen to the latest question.');
    const args=request.arguments;if(!args||typeof args!=='object'||Array.isArray(args)||JSON.stringify(args).length>8000)throw new Error('Invalid tool arguments.');
    let result: Record<string,unknown>;let order: Order | undefined;
    switch(request.name) {
      case 'list_products': result={products:publicCatalog(),note:'These are fictional demonstration products with explicitly defined specifications.'};break;
      case 'show_product': {const p=getProduct(String(args.product_id));this.select(p.id);result={product:publicProduct(p),approved_unit_price:this.state.quote!.unitPriceCents/100,currency:p.currency};break;}
      case 'negotiate_price': {if(Object.keys(args).some(k=>!['product_id','offer'].includes(k)))throw new Error('Unexpected price arguments.');const snapshot=this.offer(String(args.product_id),args.offer);const q=snapshot.quote!;result={approved:q.status!=='REJECTED',unit_price:q.unitPriceCents/100,currency:'USD',message:q.message,product_id:q.productId};break;}
      case 'prepare_order': {if(Object.keys(args).some(k=>!['product_id','quantity'].includes(k)))throw new Error('The final price is set only by the local pricing engine.');order=this.prepare(String(args.product_id),args.quantity===undefined?1:(typeof args.quantity==='number'?args.quantity:NaN),request.turnId);result={order_id:order.id,product:order.productName,quantity:order.quantity,unit_price:order.finalUnitPriceCents/100,total:order.totalCents/100,currency:order.currency,status:order.status,payment_status:order.paymentStatus,note:'Simulated order only. No payment has been taken.'};break;}
      default: throw new Error('Unsupported sales tool.');
    }
    const value={result,snapshot:this.snapshot(),...(order?{order}:{})};this.results.set(request.callId,value);return structuredClone(value);
  }
}

export type VoiceState = 'LISTENING' | 'THINKING' | 'SPEAKING' | 'INTERRUPTED' | 'DISCONNECTED';
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';
export interface Product { id: string; name: string; category: string; image: string; description: string; specifications: Record<string,string>; originalPriceCents: number; currency: 'USD'; }
export interface CatalogProduct extends Product { targetPriceCents: number; minimumPriceCents: number; }
export interface Quote { productId: string; unitPriceCents: number; status: 'ORIGINAL' | 'APPROVED' | 'REJECTED'; message: string; offeredCents?: number; revision: number; }
export interface Order { id: string; productId: string; productName: string; quantity: number; originalUnitPriceCents: number; finalUnitPriceCents: number; totalCents: number; currency: 'USD'; createdAt: string; conversationReference: string; customerTurnId: string; status: 'PENDING'; paymentStatus: 'UNPAID'; idempotencyKey: string; }
export interface SalesSnapshot { sessionId: string; productId: string | null; quote: Quote | null; }
export interface LocalRuntimeSettings { mode:'LOCAL_OFFLINE'; runtimeDirectory:string; ollamaUrl:string; ollamaModel:string; whisperPath:string; whisperModel:string; piperPath:string; piperModel:string; language:'auto'|'en'|'zh'; microphoneId:string; outputId:string; }
export interface PublicSettings extends LocalRuntimeSettings { hasApiKey: false; keyHint: ''; encryptionAvailable: boolean; }
export type SettingsUpdate = Partial<LocalRuntimeSettings>;
export interface Bootstrap { catalog: Product[]; snapshot: SalesSnapshot; settings: PublicSettings; orders: Order[]; version: string; platform: string; storageNotice: string | null; }
export interface ToolRequest { sessionId: string; turnId: string | null; callId: string; name: string; arguments: Record<string,unknown>; }
export interface ToolResult { result: Record<string,unknown>; snapshot: SalesSnapshot; order?: Order; }
export interface SalesBridge {
  bootstrap(): Promise<Bootstrap>;
  saveSettings(update: SettingsUpdate): Promise<PublicSettings>;
  testConnection(): Promise<{ok: boolean; message: string}>;
  checkLocalRuntime(): Promise<{name:string;ok:boolean;detail:string}[]>;
  loadRuntimeDirectory(directory:string): Promise<PublicSettings>;
  chooseRuntimeDirectory(): Promise<PublicSettings|null>;
  openLocalSetup(): Promise<void>;
  verifyRuntimeFiles(): Promise<{name:string;ok:boolean;detail:string}[]>;
  beginLocalTurn(turnId:string): Promise<void>;
  localChat(turnId:string,messages:Array<{role:string;content:string}>,onToken:(token:string)=>void): Promise<{text:string}>;
  cancelLocalTurn(turnId:string): Promise<void>;
  localTranscribe(turnId:string,pcmBase64:string,sampleRate?:number): Promise<string>;
  localSpeak(turnId:string,text:string): Promise<string>;
  startSession(productId?: string): Promise<SalesSnapshot>;
  stopSession(sessionId: string): Promise<void>;
  beginTurn(sessionId: string, turnId: string): Promise<void>;
  completeTurn(sessionId: string, turnId: string, text: string): Promise<void>;
  tool(request: ToolRequest): Promise<ToolResult>;
  selectProduct(productId: string): Promise<SalesSnapshot>;
  checkOffer(productId: string, dollars: number): Promise<SalesSnapshot>;
  acceptOffer(productId: string, quantity: number): Promise<Order>;
  orders(): Promise<Order[]>;
}
export interface TranscriptEntry { id: string; role: 'customer' | 'assistant' | 'system'; text: string; time: number; interrupted?: boolean; }
export const money = (cents: number, currency = 'USD') => new Intl.NumberFormat('en-US', {style:'currency',currency}).format(cents / 100);

import {describe,it,expect} from 'vitest';
import {localOllamaUrl} from '../src/main/local-runtime';
import {quotedOffer,acceptsOffer} from '../src/renderer/services/local-offline';

describe('local-only controls',()=>{
  it('permits only the fixed loopback Ollama service',()=>{
    expect(localOllamaUrl('http://127.0.0.1:11434')).toBe('http://127.0.0.1:11434');
    for(const address of ['https://127.0.0.1:11434','http://localhost:11434','http://127.0.0.1:11435','http://127.0.0.1:11434/other','http://example.com:11434'])expect(()=>localOllamaUrl(address)).toThrow();
  });
  it('detects numeric counteroffers and explicit agreement',()=>{
    expect(quotedOffer('Can you do $85?')).toBe(85);
    expect(quotedOffer('How about $65?')).toBe(65);
    expect(quotedOffer('How about 65 dollars?')).toBe(65);
    expect(quotedOffer('I can pay eighty five dollars.')).toBe(85);
    expect(acceptsOffer('Deal! I will take it.')).toBe(true);
    expect(acceptsOffer('Maybe I will take it if you lower the price.')).toBe(false);
  });
});

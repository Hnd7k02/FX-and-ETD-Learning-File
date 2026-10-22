import { describe, expect, it } from 'vitest';
import {
  aboutPath,
  glossaryPath,
  homePath,
  langFromPath,
  modulePath,
  riskometerPath,
  switchLangPath,
} from '@/i18n/routes';

describe('routes', () => {
  it('builds localized paths', () => {
    expect(homePath('de')).toBe('/');
    expect(homePath('en')).toBe('/en/');
    expect(modulePath('de', '05-greeks', '2')).toBe('/module/05-greeks/2/');
    expect(modulePath('en', '05-greeks', 'quiz')).toBe('/en/module/05-greeks/quiz/');
    expect(modulePath('de', '01-spot')).toBe('/module/01-spot/1/');
    expect(riskometerPath('en')).toBe('/en/riskometer/');
    expect(glossaryPath('de')).toBe('/glossar/');
    expect(glossaryPath('en')).toBe('/en/glossary/');
    expect(aboutPath('de')).toBe('/ueber/');
    expect(aboutPath('en')).toBe('/en/about/');
  });

  it('switches language on the same page', () => {
    expect(switchLangPath('/', 'en')).toBe('/en/');
    expect(switchLangPath('/en/', 'de')).toBe('/');
    expect(switchLangPath('/en', 'de')).toBe('/');
    expect(switchLangPath('/module/05-greeks/2/', 'en')).toBe('/en/module/05-greeks/2/');
    expect(switchLangPath('/en/module/05-greeks/quiz/', 'de')).toBe('/module/05-greeks/quiz/');
    expect(switchLangPath('/glossar/', 'en')).toBe('/en/glossary/');
    expect(switchLangPath('/en/glossary/', 'de')).toBe('/glossar/');
    expect(switchLangPath('/ueber/', 'en')).toBe('/en/about/');
    expect(switchLangPath('/en/about/', 'de')).toBe('/ueber/');
    expect(switchLangPath('/riskometer', 'en')).toBe('/en/riskometer/');
    expect(switchLangPath('/en/riskometer/', 'en')).toBe('/en/riskometer/');
    expect(switchLangPath('/riskometer/', 'de')).toBe('/riskometer/');
  });

  it('detects the language of a path', () => {
    expect(langFromPath('/en/')).toBe('en');
    expect(langFromPath('/en')).toBe('en');
    expect(langFromPath('/english/')).toBe('de');
    expect(langFromPath('/')).toBe('de');
  });
});

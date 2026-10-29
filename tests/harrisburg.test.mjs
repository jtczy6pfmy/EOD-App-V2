import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const state=require('../report-state.js');
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const script=html.match(/<script>\s*\(\(\)=>\{([\s\S]*?)<\/script>/)?.[0];
test('Harrisburg is fixed without renaming data persistence keys',()=>{
  assert.match(html,/<select id="terminal"[^>]*disabled><option selected>HARRISBURG<\/option><\/select>/);
  assert.doesNotMatch(html,/CALUMET|CHGO 63RD|SPECIAL|loadTerminalPreference/);
  assert.match(fs.readFileSync(new URL('../supabase-sync.js',import.meta.url),'utf8'),/eodInspectionReport_v14_/);
});
test('Harrisburg prefix and equipment length validation still works',()=>{
  assert.equal(state.validate('chassis','5652','AIMZ 12345','HARRISBURG'), '');
  assert.notEqual(state.validate('chassis','5652','AIMZ 123456','HARRISBURG'), '');
  assert.equal(state.validate('chassis','5652','NSPZ 123456','HARRISBURG'), '');
  assert.notEqual(state.validate('chassis','5652','TSXZ 123456','HARRISBURG'), '');
  assert.equal(state.validate('containers','5653','ABCD 123456','HARRISBURG'), '');
  assert.equal(state.validate('racks','5657','ZNSU 123456','HARRISBURG'), '');
});
test('48 audits and 17 regular inspections yield 17 completed, with no conversion text in report',()=>{
  const fn=html.match(/function total\(\)\{[^\n]+/)[0];
  const context={data:{tireAudits:48},inspectionTotal:()=>17,result:0};vm.createContext(context);vm.runInContext(fn+';result=total()',context);
  assert.equal(context.result,17);
  const report=html.slice(html.indexOf('function buildReportText()'),html.indexOf('function generateEOD()'));
  assert.match(report,/WORKSHEET ROWS/);
  assert.doesNotMatch(report,/Math.floor|Inspection credit/);
  assert.match(html,/function getTarget\(\)\{return 30\}/);
});

test('audit worksheet ranges survive saving, syncing and legacy report loading',()=>{
  const legacy={terminal:'HARRISBURG',date:'2026-10-29',data:state.emptyData(),notes:''};
  const old=state.normalize(legacy);
  delete old._sync.fields.tireAuditRows;
  assert.equal(state.normalize(old).data.tireAuditRows,'');
  const draft={...legacy,data:{...legacy.data,tireAudits:48,tireAuditRows:'120–135, 140–142'}};
  const saved=state.save(old,draft,'test',100);
  const merged=state.merge(saved,old);
  assert.equal(merged.data.tireAuditRows,'120–135, 140–142');
  assert.equal(merged.data.tireAudits,48);
});

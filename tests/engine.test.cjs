const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const all={};for(const id of ['viewRoot','sidebar','mobileScrim','crumb','toast','mainNav','menuToggle','newProjectTop','saveTop']){all[id]={innerHTML:'',textContent:'',classList:{add(){},remove(){},toggle(){}},addEventListener(){}};}
const memory={};const localStorage={getItem:k=>memory[k]??null,setItem:(k,v)=>memory[k]=v};
const doc={getElementById:k=>all[k]||null,querySelectorAll:()=>[]};
const win={localStorage,scrollTo(){}}; const ctx={window:win,document:doc,localStorage,Date,Math,Number,JSON,Array,String,Object,console,clearTimeout,setTimeout};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../app.js'),'utf8'),ctx);
const {projection,newProject,stats,types,scenarios}=win.SimVestDemo;
assert.equal(Object.keys(types).length,3,'all three Phase 1 modules exist');
const f=newProject('food'),base=projection(f,scenarios.base);assert.equal(base.length,12);
assert.equal(base[0].units,45*26);assert.equal(base[0].revenue,45*26*2700);
assert.equal(base[0].cogs,45*26*1200);assert.equal(base[0].interest,1200000*.18/12);
assert.equal(base[0].profit,base[0].revenue-base[0].cogs-base[0].fixed-base[0].interest);
assert.equal(base[0].cash,f.finance.funds-f.finance.setupCost+base[0].profit-f.finance.principal);
assert.equal(base[0].debt,1200000-80000);
assert.equal(base[0].openingCash,2500000);assert(base[11].debt>=0);
const drop=projection(f,scenarios.demand),costs=projection(f,scenarios.costs);
assert.equal(drop[0].revenue,base[0].revenue);assert(drop[3].revenue<base[3].revenue);assert(costs[3].profit<base[3].profit);
for(const type of Object.keys(types)){
 const p=newProject(type);p.period=36;p.ops.sales=10000;p.ops.capacity=80;
 const rows=projection(p,scenarios.base);assert.equal(rows.length,36);assert.equal(rows[0].units,80*p.ops.days);
 assert(rows.every(r=>Object.values(r).filter(v=>typeof v==='number').every(Number.isFinite)));
}
const zeroDebt=newProject('retail');zeroDebt.finance.debt=0;const debtRows=projection(zeroDebt,scenarios.base);assert(debtRows.every(r=>r.debt===0&&r.interest===0&&r.principal===0));
assert(all.viewRoot.innerHTML.includes('Business performance forecast'),'overview rendered');
assert(stats(base,f).last===base.at(-1));
console.log('PASS: 3 modules, forecasts, revenue, costs, loans, scenario shocks, capacity and DOM initialization');

const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const context=vm.createContext({Math,Number});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../3d/js/precision-zoom.js'),'utf8').replaceAll('export ','')+';globalThis.units=wheelUnits;',context);
test('Shift-wheel translated to horizontal input retains precision zoom input',()=>{
 assert.equal(context.units({deltaY:0,deltaX:-100,shiftKey:true}),-1);
 assert.equal(context.units({deltaY:0,deltaX:-100,shiftKey:false}),0);
 assert.equal(context.units({deltaY:-100,deltaX:0,shiftKey:true}),-1);
});

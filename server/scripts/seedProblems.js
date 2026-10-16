// Insert-only author-created problem seed. Answers live outside the server build context.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const mongoose=require('mongoose');
require('dotenv').config({path:path.resolve(__dirname,'../../.env'),quiet:true});
const Problem=require('../models/problem.model');
const dataPath=path.join(__dirname,'data/problems.json');
const ledgerPath=path.join(__dirname,'seeded-titles.json');
const verificationPath=path.resolve(__dirname,'../../test/server/problem-set/verification.json');
const args=process.argv.slice(2);
const write=args.includes('--write'), rollback=args.includes('--rollback');
function saveLedger(ledger){
  fs.writeFileSync(ledgerPath+'.tmp',JSON.stringify(ledger,null,2)+'\n',{mode:0o600});
  fs.renameSync(ledgerPath+'.tmp',ledgerPath);
}
async function main(){
  if(args.some(a=>!['--write','--rollback'].includes(a))||(write&&rollback))throw Error('Use no flags, --write, or --rollback.');
  if(!process.env.MONGO_URI)throw Error('MONGO_URI must be set.');
  const uri=new URL(process.env.MONGO_URI);
  const database=decodeURIComponent(uri.pathname.slice(1))||'test';
  console.log('Database: '+JSON.stringify(database));
  // Fingerprint scopes rollback to the exact configured URI without storing credentials.
  const targetHash=crypto.createHash('sha256').update(process.env.MONGO_URI).digest('hex');
  const ledger=fs.existsSync(ledgerPath)?JSON.parse(fs.readFileSync(ledgerPath,'utf8')):{database,targetHash,inserted:[]};
  if(ledger.database!==database||ledger.targetHash!==targetHash)throw Error('Seed ledger belongs to a different database configuration.');
  if(!Array.isArray(ledger.inserted)||ledger.inserted.some(x=>typeof x.title!=='string'||!mongoose.isValidObjectId(x._id)))throw Error('Invalid seed ledger.');
  let data=[];
  if(!rollback){
    const bytes=fs.readFileSync(dataPath);data=JSON.parse(bytes);
    if(new Set(data.map(p=>p.title)).size!==data.length)throw Error('Duplicate titles in seed data.');
    for(const p of data){
      if(Object.keys(p).sort().join(',')!=='description,difficulty,starterCode,testCases,title')throw Error('Unexpected problem fields.');
      await new Problem(p).validate();
      if(p.testCases.length<1||p.testCases.length>20||p.testCases.some(t=>Buffer.byteLength(t.input)>10000||Buffer.byteLength(t.output)>10000))throw Error('Problem exceeds execution limits.');
    }
    if(write){
      if(!fs.existsSync(verificationPath))throw Error('Run the local judge verifier before --write.');
      const v=JSON.parse(fs.readFileSync(verificationPath));
      const hash=crypto.createHash('sha256').update(bytes).digest('hex');
      const controllerHash=crypto.createHash('sha256').update(fs.readFileSync(path.resolve(__dirname,'../controllers/code.controller.js'))).digest('hex');
      if(!v.success||!/^v22\./.test(v.runtime)||v.sandboxHash!==crypto.createHash('sha256').update(fs.readFileSync(path.resolve(__dirname,'../services/sandbox.js'))).digest('hex')||v.dataHash!==hash||v.controllerHash!==controllerHash||v.rows.length!==data.length||v.rows.some(r=>r.passed!==r.total||!r.agreement)||v.negatives.length!==3)throw Error('Verification is missing or stale.');
    }
  }
  await mongoose.connect(process.env.MONGO_URI,{serverSelectionTimeoutMS:15000});
  const before=await Problem.countDocuments();console.log('Problems before: '+before);
  if(rollback){
    // Require both ID and title: never delete an unrelated document with a reused title.
    let deleted=0;
    for(const record of ledger.inserted){const r=await Problem.deleteOne({_id:record._id,title:record.title});deleted+=r.deletedCount;}
    ledger.inserted=[];saveLedger(ledger);
    console.log('Rollback deleted: '+deleted);
  }else{
    let inserted=0,skipped=0;
    for(const p of data){
      if(await Problem.exists({title:p.title})){skipped++;continue;}
      if(write){
        const doc=new Problem(p);
        // Journal the reserved ID before the insert, so interrupted runs remain reversible.
        ledger.inserted.push({_id:doc._id.toString(),title:p.title});saveLedger(ledger);
        await doc.save();
      }
      inserted++;
    }
    console.log(`${write?'Inserted':'Would insert'}: ${inserted}; skipped existing titles: ${skipped}`);
  }
  console.log('Problems after: '+await Problem.countDocuments());
}
main().catch(error=>{
  // Do not dump driver errors, connection strings, hosts, or credentials.
  const safeMessages=['Use no flags, --write, or --rollback.','MONGO_URI must be set.','Seed ledger belongs to a different database configuration.','Invalid seed ledger.','Duplicate titles in seed data.','Unexpected problem fields.','Problem exceeds execution limits.','Run the local judge verifier before --write.','Verification is missing or stale.'];
  console.error(safeMessages.includes(error.message)?error.message:'Seed operation failed (configuration, validation, database access, or filesystem error); no secret details printed.');
  process.exitCode=1;
}).finally(()=>mongoose.disconnect());

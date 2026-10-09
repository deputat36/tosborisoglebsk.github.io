const assert=require('node:assert/strict'),{applyReviewedRaster}=require('./lib/reviewed_visual_rasters');
const baseline={case_id:'case',route:'/workbench/',theme:'light',interaction:'none',mode:'screen',reviewed_raster_sha256:['a'.repeat(64),'b'.repeat(64)],raster_review_note:'Two visually reviewed identical layouts'};
const sample={...baseline,size_equal:true,current_sha256:'a'.repeat(64),pixel_equivalent:false};
assert.equal(applyReviewedRaster(sample,baseline).pixel_equivalent,true);
for(const change of [{current_sha256:'c'.repeat(64)},{route:'/news/'},{size_equal:false},{theme:'dark'}])assert.equal(applyReviewedRaster({...sample,...change},baseline).pixel_equivalent,false);
assert.throws(()=>applyReviewedRaster(sample,{...baseline,reviewed_raster_sha256:['a']}));
console.log('Reviewed raster hashes accept only exact known bytes and matching case identity');

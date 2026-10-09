function applyReviewedRaster(comparison,baseline){
 const hashes=baseline.reviewed_raster_sha256;
 if(!Array.isArray(hashes))return comparison;
 if(hashes.length!==2||hashes.some(x=>! /^[a-f0-9]{64}$/.test(x))||!baseline.raster_review_note)throw Error('Invalid reviewed raster registry');
 const identity=['case_id','route','theme','interaction','mode'].every(k=>comparison[k]===baseline[k]);
 if(identity&&comparison.size_equal&&hashes.includes(comparison.current_sha256))return {...comparison,pixel_equivalent:true,equivalence_reason:'reviewed_exact_raster'};
 return comparison;
}
module.exports={applyReviewedRaster};

// Count/render the text visitors actually see, not the length of HTML entities.
function decodeHtmlText(value) {
  const named={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:'\u00a0'};
  return String(value || '').replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi,(match,entity)=>{
    if (entity[0] !== '#') return named[entity.toLowerCase()] || match;
    const number=entity[1].toLowerCase()==='x'?parseInt(entity.slice(2),16):parseInt(entity.slice(1),10);
    return number>0&&number<=0x10ffff&&!(number>=0xd800&&number<=0xdfff)?String.fromCodePoint(number):match;
  });
}
module.exports={decodeHtmlText};

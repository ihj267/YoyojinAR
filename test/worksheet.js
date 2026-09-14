/* The questions printed on combined.pdf, with literal AI transcriptions. */
(() => {
  'use strict';
  const questions = Object.freeze([
    {key:'creatureName',number:2,label:'생명체의 이름은 무엇인가요?',max:240},
    {key:'habitat',number:3,label:'어디에 살고 있나요?',max:2000},
    {key:'likes',number:4,label:'무엇을 좋아하나요?',max:2000},
    {key:'effect',number:5,label:'이 친구가 나타나면 친구들이나 자연에 어떤 일이 생기나요?',max:4000},
    {key:'help',number:6,label:'이 친구에게 도움이 필요할 때, 무엇을 해줄 수 있을까요?',max:4000}
  ]);
  const privateFields = Object.freeze([{key:'participantName',label:'참여자 이름 · 원본 기록',max:120},...questions]);
  function validate(value, {publicView=false}={}) {
    if (value == null) return null;
    if (!value || typeof value!=='object' || Array.isArray(value) || value.source!=='pdf-ai-v1' || typeof value.reviewed!=='boolean') throw new Error('PDF 인식 내용의 형식이 올바르지 않습니다.');
    const expected = (publicView && !Object.hasOwn(value,'participantName')) ? questions : privateFields;
    const keys=['source','reviewed',...expected.map(f=>f.key)];
    if(Object.keys(value).length!==keys.length || Object.keys(value).some(k=>!keys.includes(k)))throw new Error('PDF 인식 항목이 맞지 않습니다.');
    const result={source:'pdf-ai-v1',reviewed:value.reviewed};
    for(const f of expected){
      const answer=value[f.key];
      if(!answer || typeof answer!=='object' || Array.isArray(answer) || Object.keys(answer).sort().join(',')!=='note,status,text' || typeof answer.text!=='string' || answer.text.length>f.max || typeof answer.note!=='string' || answer.note.length>1000 || !['read','uncertain','blank','edited'].includes(answer.status) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(answer.text+answer.note) || (answer.status==='blank' && answer.text!==''))throw new Error(`${f.label}: 인식 내용이 올바르지 않습니다.`);
      result[f.key]={text:answer.text,status:answer.status,note:answer.note};
    }
    return result;
  }
  function readDocument(doc) {
    if(doc?.version!==1 || doc.source!=='combined.pdf' || doc.totalPages!==499 || !Array.isArray(doc.items) || doc.items.length>499)throw new Error('PDF 자동 입력 자료를 확인해 주세요.');
    const entries=new Map();
    for(const record of doc.items){
      if(!record || Object.keys(record).length!==privateFields.length+1)throw new Error('PDF 인식 자료의 항목 수가 맞지 않습니다.');
      if(typeof record.id!=='string' || !/^\d{3}$/.test(record.id) || Number(record.id)<1 || Number(record.id)>499 || entries.has(record.id))throw new Error('PDF 인식 자료의 쪽 번호가 올바르지 않습니다.');
      const {id,...fields}=record;
      entries.set(id,validate({source:'pdf-ai-v1',reviewed:false,...fields}));
    }
    return entries;
  }
  function merge(catalog,entries) {
    let added=0;
    const items=catalog.items.map(item=>{
      if(item.worksheet || !entries.has(item.id))return item;
      added++;
      return {...item,worksheet:validate(entries.get(item.id))};
    });
    return {catalog:added?{...catalog,items}:catalog,added};
  }
  const titleOf=item=>item.worksheet?.creatureName?.text || item.title || `아이의 그림 ${item.id}`;
  window.YoyojinWorksheet = Object.freeze({questions,privateFields,validate,readDocument,merge,titleOf});
})();

// HomeCashbacks — Shared JS
// Modal
function openModal(){document.getElementById('modal').classList.add('open');document.body.style.overflow='hidden';}
function closeModal(){document.getElementById('modal').classList.remove('open');document.body.style.overflow='';}
document.addEventListener('DOMContentLoaded',function(){
  var overlay=document.getElementById('modal');
  if(overlay){overlay.addEventListener('click',function(e){if(e.target===this)closeModal();});}
});
document.addEventListener('keydown',function(e){if(e.key==='Escape')closeModal();});

// Nav
function toggleMobMenu(){document.getElementById('nav-links').classList.toggle('open');document.getElementById('hamburger').classList.toggle('open');}
function closeMobMenu(){document.getElementById('nav-links').classList.remove('open');document.getElementById('hamburger').classList.remove('open');}

// Form submission
function handleFormSubmit(formName){
  var form=document.getElementById('form-'+formName);
  var nameId=formName==='contact'?'f-name':'m-name';
  var emailId=formName==='contact'?'f-email':'m-email';
  var phoneId=formName==='contact'?'f-phone':'m-phone';
  var name=document.getElementById(nameId).value.trim();
  var email=document.getElementById(emailId)?.value.trim()||'';
  var phone=document.getElementById(phoneId)?.value.trim()||'';
  var ok=true;
  document.querySelectorAll('.f-error').forEach(function(el){el.classList.remove('show');el.textContent='';});
  document.querySelectorAll('.f-input').forEach(function(el){el.classList.remove('err');});
  if(!name){
    var errName=document.getElementById('err-name')||document.getElementById('err-m-name');
    if(errName){errName.textContent='Please enter your name.';errName.classList.add('show');}
    document.getElementById(nameId).classList.add('err');ok=false;
  }
  if(!email&&!phone){
    var errContact=document.getElementById('err-contact')||document.getElementById('err-m-contact');
    if(errContact){errContact.textContent='Please enter your email or phone number.';errContact.classList.add('show');}
    ok=false;
  }
  if(!ok)return;
  var fd=new FormData(form);
  fetch('/',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(fd).toString()})
    .then(function(){document.getElementById('modal-form-wrap').style.display='none';document.getElementById('form-success').style.display='block';})
    .catch(function(){document.getElementById('modal-form-wrap').style.display='none';document.getElementById('form-success').style.display='block';});
}

(function(){
  try{
    setupPlayerEvents();
    init();
  }catch(e){
    console.error('[StreamVault] boot failed:', e);
    const heroTitle = document.getElementById('heroTitle');
    if(heroTitle)heroTitle.textContent = 'Could not start StreamVault';
  }
})();

/** Script exécuté avant l'affichage (dans <head>) : applique le thème choisi sans flash. */
export const SCRIPT_THEME = `try{var t=localStorage.getItem('pastille-theme');if(t==='clair')document.documentElement.dataset.theme='light';else if(t==='sombre')document.documentElement.dataset.theme='dark'}catch(e){}`

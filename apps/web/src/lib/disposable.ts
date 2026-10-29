/** Throwaway mail services: refused for new accounts when anyone can sign up. */
const DISPOSABLE=new Set(["mailinator.com","guerrillamail.com","guerrillamail.net","sharklasers.com","10minutemail.com","10minutemail.net",
  "tempmail.com","temp-mail.org","temp-mail.io","yopmail.com","yopmail.net","trashmail.com","getnada.com","nada.email","dispostable.com",
  "maildrop.cc","throwawaymail.com","fakeinbox.com","mailnesia.com","mintemail.com","emailondeck.com","moakt.com","tempr.email",
  "discard.email","mailcatch.com","spamgourmet.com","mytemp.email","tempinbox.com","burnermail.io","inboxkitten.com","mohmal.com"]);
export const isDisposable=(email:string)=>DISPOSABLE.has((email.split("@")[1]??"").trim().toLowerCase());

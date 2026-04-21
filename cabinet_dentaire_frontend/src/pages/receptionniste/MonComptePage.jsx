/**
 * pages/receptionniste/MonComptePage.jsx
 * Identique au dentiste — pas de specialite/numero_ordre.
 */
import React, { useState } from "react";
import { updateProfile, changePassword } from "@/api/authAPI";
import { useAuth }                       from "@/hooks/useAuth";

const S = {
  page:      { minHeight:"100vh", backgroundColor:"#f8fafc", fontFamily:"system-ui, sans-serif", padding:"2rem" },
  title:     { fontSize:"1.4rem", fontWeight:"700", color:"#0f172a", margin:"0 0 1.75rem" },
  tabs:      { display:"flex", gap:0, marginBottom:"1.75rem", borderBottom:"1.5px solid #e2e8f0" },
  tab:       (a)=>({ padding:"0.6rem 1.25rem", fontWeight:a?"600":"400", color:a?"#7c3aed":"#64748b", background:"none", border:"none", borderBottom:a?"2.5px solid #7c3aed":"2.5px solid transparent", cursor:"pointer", fontSize:"0.9rem", marginBottom:"-1.5px" }),
  card:      { backgroundColor:"#fff", borderRadius:"12px", padding:"1.75rem", maxWidth:"520px", boxShadow:"0 1px 3px rgba(0,0,0,0.07)" },
  formGroup: { marginBottom:"1rem" },
  label:     { display:"block", fontSize:"0.85rem", fontWeight:"500", color:"#374151", marginBottom:"0.35rem" },
  input:     { width:"100%", padding:"0.6rem 0.875rem", border:"1.5px solid #d1d5db", borderRadius:"8px", fontSize:"0.9rem", color:"#1e293b", boxSizing:"border-box", outline:"none" },
  row:       { display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0.75rem" },
  btn:       { padding:"0.65rem 1.5rem", backgroundColor:"#7c3aed", color:"#fff", border:"none", borderRadius:"8px", fontSize:"0.9rem", fontWeight:"600", cursor:"pointer" },
  success:   { backgroundColor:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:"8px", padding:"0.75rem 1rem", color:"#166534", fontSize:"0.875rem", marginBottom:"1rem" },
  errorBox:  { backgroundColor:"#fef2f2", border:"1px solid #fecaca", borderRadius:"8px", padding:"0.75rem 1rem", color:"#dc2626", fontSize:"0.875rem", marginBottom:"1rem" },
  fieldErr:  { fontSize:"0.78rem", color:"#dc2626", marginTop:"0.2rem" },
  inputErr:  { borderColor:"#ef4444" },
  avatarRow: { display:"flex", alignItems:"center", gap:"1rem", marginBottom:"1.5rem" },
  avatar:    { width:"60px", height:"60px", borderRadius:"50%", backgroundColor:"#f3e8ff", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"1.375rem", fontWeight:"700", color:"#7c3aed" },
};

function TabProfil() {
  const { user, updateUser } = useAuth();
  const [form, setForm] = useState({ first_name:user?.first_name??"", last_name:user?.last_name??"", phone:user?.phone??"" });
  const [errors,setErrors]=useState({});const[saving,setSaving]=useState(false);const[ok,setOk]=useState(false);
  const set=(f,v)=>{setForm(p=>({...p,[f]:v}));setErrors(e=>({...e,[f]:undefined}));setOk(false);};
  const submit=async(e)=>{
    e.preventDefault();setSaving(true);setErrors({});setOk(false);
    try{const{data}=await updateProfile(form);updateUser(data);setOk(true);}
    catch(err){const d=err?.response?.data??{};if(d.detail)setErrors({_g:d.detail});else{const m={};Object.entries(d).forEach(([k,v])=>{m[k]=Array.isArray(v)?v[0]:v;});setErrors(m);}}
    finally{setSaving(false);}
  };
  const initials=`${user?.first_name?.[0]??''}${user?.last_name?.[0]??''}`.toUpperCase()||'R';
  return(
    <div style={S.card}>
      <div style={S.avatarRow}>
        <div style={S.avatar}>{initials}</div>
        <div>
          <p style={{margin:0,fontWeight:"600",color:"#1e293b"}}>{user?.full_name}</p>
          <p style={{margin:0,fontSize:"0.85rem",color:"#64748b"}}>{user?.email}</p>
          <p style={{margin:0,fontSize:"0.78rem",color:"#94a3b8",marginTop:"0.2rem"}}>Réceptionniste</p>
        </div>
      </div>
      {ok&&<div style={S.success}>✅ Profil mis à jour.</div>}
      {errors._g&&<div style={S.errorBox}>⚠ {errors._g}</div>}
      <form onSubmit={submit}>
        <div style={S.row}>
          <div style={S.formGroup}><label style={S.label}>Prénom</label><input type="text" value={form.first_name} onChange={e=>set("first_name",e.target.value)} style={{...S.input,...(errors.first_name?S.inputErr:{})}} />{errors.first_name&&<p style={S.fieldErr}>{errors.first_name}</p>}</div>
          <div style={S.formGroup}><label style={S.label}>Nom</label><input type="text" value={form.last_name} onChange={e=>set("last_name",e.target.value)} style={{...S.input,...(errors.last_name?S.inputErr:{})}} /></div>
        </div>
        <div style={S.formGroup}><label style={S.label}>Téléphone</label><input type="tel" value={form.phone} onChange={e=>set("phone",e.target.value)} style={S.input} /></div>
        <button type="submit" disabled={saving} style={{...S.btn,opacity:saving?0.65:1}}>{saving?"Enregistrement…":"Enregistrer"}</button>
      </form>
    </div>
  );
}

function TabSecurite() {
  const [form,setForm]=useState({current_password:"",new_password:"",new_password_confirm:""});
  const [errors,setErrors]=useState({});const[saving,setSaving]=useState(false);const[ok,setOk]=useState(false);const[show,setShow]=useState(false);
  const set=(f,v)=>{setForm(p=>({...p,[f]:v}));setErrors(e=>({...e,[f]:undefined}));setOk(false);};
  const submit=async(e)=>{
    e.preventDefault();if(form.new_password!==form.new_password_confirm){setErrors({new_password_confirm:"Les mots de passe ne correspondent pas."});return;}
    setSaving(true);setErrors({});setOk(false);
    try{await changePassword(form);setOk(true);setForm({current_password:"",new_password:"",new_password_confirm:""});}
    catch(err){const d=err?.response?.data??{};if(d.detail)setErrors({_g:d.detail});else{const m={};Object.entries(d).forEach(([k,v])=>{m[k]=Array.isArray(v)?v[0]:v;});setErrors(m);}}
    finally{setSaving(false);}
  };
  const fp=(n)=>({type:show?"text":"password",value:form[n],onChange:e=>set(n,e.target.value),style:{...S.input,...(errors[n]?S.inputErr:{})}});
  return(
    <div style={S.card}>
      <h2 style={{fontSize:"1rem",fontWeight:"600",color:"#1e293b",margin:"0 0 1.25rem"}}>🔐 Changer le mot de passe</h2>
      {ok&&<div style={S.success}>✅ Mot de passe modifié.</div>}
      {errors._g&&<div style={S.errorBox}>⚠ {errors._g}</div>}
      <form onSubmit={submit}>
        <div style={S.formGroup}><label style={S.label}>Mot de passe actuel</label><input {...fp("current_password")} /></div>
        <div style={S.formGroup}><label style={S.label}>Nouveau mot de passe</label><input {...fp("new_password")} />{errors.new_password&&<p style={S.fieldErr}>{errors.new_password}</p>}</div>
        <div style={S.formGroup}><label style={S.label}>Confirmer</label><input {...fp("new_password_confirm")} />{errors.new_password_confirm&&<p style={S.fieldErr}>{errors.new_password_confirm}</p>}</div>
        <div style={{display:"flex",alignItems:"center",gap:"0.5rem",marginBottom:"1.25rem"}}><input type="checkbox" id="sp2" checked={show} onChange={e=>setShow(e.target.checked)}/><label htmlFor="sp2" style={{fontSize:"0.85rem",color:"#64748b",cursor:"pointer"}}>Afficher les mots de passe</label></div>
        <button type="submit" disabled={saving} style={{...S.btn,opacity:saving?0.65:1}}>{saving?"Modification…":"Changer le mot de passe"}</button>
      </form>
    </div>
  );
}

export default function MonComptePage() {
  const [tab,setTab]=useState("profil");
  return(
    <div style={S.page}>
      <h1 style={S.title}>⚙️ Mon compte</h1>
      <div style={S.tabs}>
        <button style={S.tab(tab==="profil")} onClick={()=>setTab("profil")}>👤 Profil</button>
        <button style={S.tab(tab==="securite")} onClick={()=>setTab("securite")}>🔐 Sécurité</button>
      </div>
      {tab==="profil"&&<TabProfil/>}
      {tab==="securite"&&<TabSecurite/>}
    </div>
  );
}
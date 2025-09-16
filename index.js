import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, query, orderBy, onSnapshot, doc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";


//Ma conf firebase
const firebaseConfig = {
  apiKey: "AIzaSyAuC0XnkI_KjbpklmuAha1eO6D4a2fjr2I",
  authDomain: "chat-fd8ca.firebaseapp.com",
  projectId: "chat-fd8ca",
  storageBucket: "chat-fd8ca.firebasestorage.app",
  messagingSenderId: "465383639643",
  appId: "1:465383639643:web:40b00502356239b6100d7e",
  measurementId: "G-G49NBE91DV"
};

// Init Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);
let username = null;
let userId = null;
// Générer un ID unique pour l'utilisateur
function generateUserId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}
// Gérer la présence utilisateur
async function setUserOnline() {
  userId = generateUserId();
  await setDoc(doc(db, "users", userId), {
    name: username,
    online: true,
    lastSeen: Date.now()
  });
  
  // Nettoyer à la déconnexion
    window.addEventListener('unload', async () => {
    await deleteDoc(doc(db, "users", userId));
    });

}
// Écouter les utilisateurs connectés
function listenToUsers() {
  const q = query(collection(db, "users"));
  onSnapshot(q, (snapshot) => {
    const usersList = document.getElementById("usersList");
    const onlineCount = document.getElementById("onlineCount");
    
    usersList.innerHTML = "";
    let count = 0;
    
    snapshot.forEach((doc) => {
      const data = doc.data();
      const userDiv = document.createElement("div");
      userDiv.classList.add("user-item");
      if (data.name === username) userDiv.classList.add("own");
      
      userDiv.innerHTML = `
        <div class="user-status"></div>
        <div class="user-name">${data.name}</div>
      `;
      
      usersList.appendChild(userDiv);
      count++;
    });
    
    onlineCount.textContent = `${count} utilisateur${count > 1 ? 's' : ''} en ligne`;
  });
}
// Attente pseudo
window.setName = async () => {
  try {
    username = document.getElementById("nameInput").value.trim();
    if (!username) return alert("Choisis un pseudo !");
    if (username.length > 20) return alert("Le pseudo doit faire moins de 20 caractères !");
    
    document.getElementById("login").style.display = "none";
    document.getElementById("chatUI").style.display = "flex";
    document.getElementById("chatHeader").textContent = `💬 Chat - Connecté en tant que ${username}`;
    
    await setUserOnline();
    loadChat();
    listenToUsers();
  } catch (error) {
    console.error("Erreur lors de la connexion:", error);
    alert("Erreur de connexion, réessaye !");
  }
};
// Charger chat
function loadChat() {
  const q = query(collection(db, "messages"), orderBy("time"));
  onSnapshot(q, (snapshot) => {
    const chat = document.getElementById("chat");
    const wasScrolledToBottom = chat.scrollHeight - chat.clientHeight <= chat.scrollTop + 1;
    
    chat.innerHTML = "";
    snapshot.forEach((doc) => {
      const data = doc.data();
      const div = document.createElement("div");
      div.classList.add("msg");
      if (data.name === username) div.classList.add("own");
      
      let content = `<span class="name">${data.name}</span>`;
      if (data.text) content += data.text;
      if (data.imageUrl) {
        content += `<br><img src="${data.imageUrl}" onclick="showImageModal('${data.imageUrl}')" />`;
      }
      
      div.innerHTML = content;
      chat.appendChild(div);
    });
    
    // Scroll automatique seulement si on était en bas
    if (wasScrolledToBottom) {
      chat.scrollTop = chat.scrollHeight;
    }
  });
}
// Modal pour agrandir les images
window.showImageModal = (imageUrl) => {
  const modal = document.getElementById("imageModal");
  const modalImage = document.getElementById("modalImage");
  modalImage.src = imageUrl;
  modal.style.display = "block";
};
// Fermer modal
window.closeImageModal = () => {
  document.getElementById("imageModal").style.display = "none";
};
// Envoyer texte
window.sendMessage = async () => {
  const input = document.getElementById("msgInput");
  const text = input.value.trim();
  if (!text) return;
  
  await addDoc(collection(db, "messages"), {
    name: username,
    text: text,
    time: Date.now()
  });
  input.value = "";
};

// Upload fichier (image)
async function uploadFile(file) {
  const storageRef = ref(storage, "images/" + Date.now() + "_" + file.name);
  try {
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    console.log("Image téléchargée, URL: ", url);
    return url;
  } catch (error) {
    console.error("Erreur upload fichier:", error);
    throw error;
  }
}

// Envoyer image
window.sendImage = async (file) => {
  if (!file) return;
  
  // Accepter tous les types d'images + formats courants
  const allowedTypes = [
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 
    'image/webp', 'image/bmp', 'image/svg+xml'
  ];
  
  if (!allowedTypes.includes(file.type)) {
    alert('Format non supporté. Utilisez: JPG, PNG, GIF, WebP, BMP, SVG');
    return;
  }
  
  // Vérification de la taille (max 10MB)
  if (file.size > 10 * 1024 * 1024) {
    alert('L\'image est trop lourde (max 10MB)');
    return;
  }
  
  try {
    const url = await uploadFile(file);
    await addDoc(collection(db, "messages"), {
      name: username,
      imageUrl: url,
      time: Date.now()
    });
  } catch (error) {
    alert('Erreur lors de l\'envoi de l\'image');
    console.error(error);
  }
};
// Coller des images depuis le presse-papier
async function handlePaste(e) {
  const items = e.clipboardData?.items;
  if (!items) return;
  
  for (let item of items) {
    if (item.type.startsWith('image/')) {
      e.preventDefault();
      const file = item.getAsFile();
      if (file) {
        await sendImage(file);
      }
      break;
    }
  }
}
// Setup des événements
document.addEventListener("DOMContentLoaded", () => {
  const dz = document.getElementById("dropZone");
  const msgInput = document.getElementById("msgInput");
  
  const enterChatBtn = document.getElementById("enterChatBtn");
  enterChatBtn.addEventListener("click", window.setName);

  // Drag & Drop
  dz.addEventListener("dragover", (e) => {
    e.preventDefault();
    dz.classList.add("dragover");
  });
  
  dz.addEventListener("dragleave", (e) => {
    if (!dz.contains(e.relatedTarget)) {
      dz.classList.remove("dragover");
    }
  });
  
  dz.addEventListener("drop", async (e) => {
    e.preventDefault();
    dz.classList.remove("dragover");
    if (e.dataTransfer.files.length > 0) {
      await sendImage(e.dataTransfer.files[0]);
    }
  });
  
  // Click pour sélectionner fichier
  dz.addEventListener("click", () => {
    document.getElementById("imgInput").click();
  });
  
  // Enter pour envoyer message
  msgInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  
  // Paste d'images
  msgInput.addEventListener("paste", handlePaste);
  document.addEventListener("paste", handlePaste);
  
  // Enter sur le pseudo
  document.getElementById("nameInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      window.setName();
    }
  });
  
  // Modal image
  document.getElementById("imageModal").addEventListener("click", closeImageModal);
});
// Nettoyage à la fermeture
window.addEventListener('beforeunload', async () => {
  if (userId) {
    try {
      await deleteDoc(doc(db, "users", userId));
    } catch (error) {
      console.error("Erreur lors du nettoyage:", error);
    }
  }
});
import { db } from "./config";
import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  setDoc,
  updateDoc, 
  deleteDoc,
  query,
  where,
  serverTimestamp
} from "firebase/firestore";
import { format } from "date-fns";

// Generic CRUD functions
export const getCollection = async (collectionName: string) => {
  const querySnapshot = await getDocs(collection(db, collectionName));
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const getDocument = async (collectionName: string, id: string) => {
  const docRef = doc(db, collectionName, id);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() };
  } else {
    return null;
  }
};

export const addDocument = async (collectionName: string, data: any) => {
  const docRef = await addDoc(collection(db, collectionName), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return docRef.id;
};

export const setDocumentWithId = async (collectionName: string, id: string, data: any) => {
  const docRef = doc(db, collectionName, id);
  await setDoc(docRef, {
    ...data,
    id,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return id;
};

export const updateDocument = async (collectionName: string, id: string, data: any) => {
  const docRef = doc(db, collectionName, id);
  await updateDoc(docRef, {
    ...data,
    updatedAt: serverTimestamp()
  });
};

export const deleteDocument = async (collectionName: string, id: string) => {
  const docRef = doc(db, collectionName, id);
  await deleteDoc(docRef);
};

// Specialized Queries
export const getControlsByRequisitionId = async (reqId: string) => {
  const q = query(collection(db, "controls"), where("requisitionId", "==", reqId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const generateCustomId = async (collectionName: string, prefix: string) => {
  const todayStr = format(new Date(), 'yyyyMMdd');
  const prefixWithDate = `${prefix}${todayStr}`;
  
  // Since we use the custom ID as the document ID, we can fetch all docs, 
  // filter by ones starting with this prefix, and find the max running number.
  // In a large system we'd use a counter, but for this scale fetching is fine.
  const allDocs = await getCollection(collectionName);
  const todaysDocs = allDocs.filter(d => d.id?.startsWith(prefixWithDate));
  
  let maxNum = 0;
  todaysDocs.forEach(d => {
    const numStr = d.id?.replace(prefixWithDate, '');
    const num = parseInt(numStr || '0', 10);
    if (!isNaN(num) && num > maxNum) {
      maxNum = num;
    }
  });
  
  const nextNum = maxNum + 1;
  const nextNumStr = nextNum.toString().padStart(3, '0');
  return `${prefixWithDate}${nextNumStr}`;
};

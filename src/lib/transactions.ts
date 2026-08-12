
import { collection, addDoc, serverTimestamp, Transaction as FirestoreTransaction, doc } from 'firebase/firestore';
import { db } from './firebase';
import type { Transaction } from './types';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

/**
 * Logs a transaction to Firestore without blocking the main execution flow.
 */
export const logTransaction = (
    transactionData: Omit<Transaction, 'id' | 'createdAt'>,
    firestoreTransaction?: FirestoreTransaction
) => {
    const dataToLog = {
        ...transactionData,
        createdAt: serverTimestamp(),
    };
    
    if (firestoreTransaction) {
        // If part of a transaction, we use the transaction reference
        const newTransactionRef = doc(collection(db, 'transactions'));
        firestoreTransaction.set(newTransactionRef, dataToLog);
    } else {
        // Standard non-blocking addDoc
        const colRef = collection(db, 'transactions');
        addDoc(colRef, dataToLog).catch(async (err) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: 'transactions',
                operation: 'create',
                requestResourceData: dataToLog
            }));
        });
    }
};

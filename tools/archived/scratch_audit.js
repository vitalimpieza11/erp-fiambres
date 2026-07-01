const fs = require('fs');
const path = require('path');

const srcPath = path.join(__dirname, 'src');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file));
        } else { 
            results.push(file);
        }
    });
    return results;
}

const allFiles = walk(srcPath);

const firestoreRules = fs.readFileSync(path.join(__dirname, 'firestore.rules'), 'utf-8');
const firebaseTs = fs.readFileSync(path.join(__dirname, 'src/lib/firebase.ts'), 'utf-8');

const output = {
  collections: [],
  repositories: [],
  stores: [],
  features: [],
  transactions: [],
  promiseAll: []
};

// Collections from firebase.ts
const collMatches = firebaseTs.match(/COLLECTIONS\s*=\s*{([^}]+)}/);
if (collMatches) {
  output.collections = collMatches[1].split(',').map(l => l.trim()).filter(l => l);
}

// Stores
allFiles.filter(f => f.includes('store') || f.includes('Store')).forEach(f => {
  const content = fs.readFileSync(f, 'utf-8');
  if (content.includes('create(') || content.includes('zustand')) {
    output.stores.push({ file: path.basename(f), path: f.replace(srcPath, '') });
  }
});

// Repositories
allFiles.filter(f => f.includes('Repository')).forEach(f => {
  const content = fs.readFileSync(f, 'utf-8');
  const funcs = [...content.matchAll(/(?:export\s+)?(?:const|async\s+function|function)\s+([a-zA-Z0-9_]+)\s*=/g)].map(m => m[1]);
  const funcs2 = [...content.matchAll(/export\s+const\s+([a-zA-Z0-9_]+)\s*={/g)].map(m => m[1]);
  output.repositories.push({ file: path.basename(f), path: f.replace(srcPath, ''), funcs, funcs2 });
});

// Transactions & Promise.all
allFiles.forEach(f => {
  const content = fs.readFileSync(f, 'utf-8');
  if (content.includes('runTransaction')) {
    output.transactions.push({ file: path.basename(f), type: 'runTransaction', count: (content.match(/runTransaction/g) || []).length });
  }
  if (content.includes('Promise.all')) {
    output.promiseAll.push({ file: path.basename(f), type: 'Promise.all', count: (content.match(/Promise\.all/g) || []).length });
  }
  if (content.includes('writeBatch')) {
    output.transactions.push({ file: path.basename(f), type: 'writeBatch', count: (content.match(/writeBatch/g) || []).length });
  }
});

fs.writeFileSync(path.join(__dirname, 'audit_raw.json'), JSON.stringify(output, null, 2));
console.log('Done');

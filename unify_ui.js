import fs from 'fs';
import path from 'path';

const pagesDir = path.join(process.cwd(), 'src', 'pages');

const replacements = [
  {
    from: /style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var\(--primary-color\)', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}/g,
    to: 'className="btn btn-primary"'
  },
  {
    from: /style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', backgroundColor: '#fff', border: '1px solid var\(--border-color\)', borderRadius: '8px', cursor: 'pointer', fontWeight: 500 }}/g,
    to: 'className="btn btn-secondary"'
  },
  {
    from: /style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', backgroundColor: 'white', border: '1px solid var\(--border-color\)', borderRadius: '8px', color: 'var\(--text-primary\)', fontWeight: 500, cursor: 'pointer' }}/g,
    to: 'className="btn btn-secondary"'
  },
  {
    from: /style={{ background: 'none', border: '1px solid var\(--border-color\)', borderRadius: '8px', padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}/g,
    to: 'className="btn btn-icon"'
  },
  {
    from: /style={{ background: '#334155', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}/g,
    to: 'className="btn btn-dark"'
  },
  {
    from: /style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#fff', color: 'var\(--text-primary\)', border: '1px solid var\(--border-color\)', padding: '10px 20px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}/g,
    to: 'className="btn btn-secondary"'
  },
  {
    from: /style={{ color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}/g,
    to: 'className="btn-danger-text"'
  },
  {
    from: /style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var\(--primary-color\)', background: 'var\(--primary-light\)', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}/g,
    to: 'className="btn btn-primary-light"'
  },
  {
    from: /style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var\(--primary-color\)', background: 'var\(--primary-light\)', border: 'none', padding: '12px 16px', borderRadius: '12px', fontWeight: 600, cursor: 'pointer', width: '100%', justifyContent: 'center', transition: 'background-color 0.2s' }}/g,
    to: 'className="btn btn-primary-light w-full"'
  },
  {
    from: /style={{ padding: '10px 16px', borderRadius: '8px', border: 'none', background: 'var\(--primary-color\)', color: '#fff', cursor: 'pointer', fontWeight: 600 }}/g,
    to: 'className="btn btn-primary"'
  },
  {
    from: /style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid var\(--border-color\)', background: '#fff', cursor: 'pointer', fontWeight: 600 }}/g,
    to: 'className="btn btn-secondary"'
  },
  {
    from: /className="border-t-4" style={{ borderTop: '4px solid var\(--primary-color\)' }}/g,
    to: 'className="card-highlight"'
  },
  {
    from: /style={{ borderLeft: '4px solid var\(--primary-color\)' }}/g,
    to: 'className="card-highlight-left"'
  }
];

function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('.tsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let originalContent = content;
      for (const rep of replacements) {
        content = content.replace(rep.from, rep.to);
      }
      if (content !== originalContent) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`Updated ${file}`);
      }
    }
  }
}

processDirectory(pagesDir);
processDirectory(path.join(process.cwd(), 'src', 'components'));

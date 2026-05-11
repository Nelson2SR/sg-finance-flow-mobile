const fs = require('fs');
const glob = require('glob'); // Note: we might not need glob if we hardcode files

const files = [
  'app/(tabs)/_layout.tsx',
  'app/(tabs)/index.tsx',
  'app/(tabs)/analytics.tsx',
  'app/(tabs)/transactions.tsx',
  'app/(tabs)/settings.tsx',
  'app/(tabs)/chat.tsx',
  'components/features/CreateVaultModal.tsx',
  'components/features/CreateBudgetModal.tsx',
  'components/features/TransactionAdderModal.tsx'
];

files.forEach(file => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');

    // Mappings
    content = content.replace(/#6366f1/g, '#E0533D'); // Indigo to Coral
    content = content.replace(/brand-500/g, 'financy-primary');
    content = content.replace(/brand-400/g, 'financy-primary');
    content = content.replace(/brand-600/g, 'financy-primary');
    content = content.replace(/brand-900/g, 'financy-primary/30');
    content = content.replace(/brand-50/g, 'financy-primary/10');
    
    // Success mapping
    content = content.replace(/emerald-500/g, 'financy-success');
    content = content.replace(/emerald-400/g, 'financy-success');
    content = content.replace(/emerald-600/g, 'financy-success');
    content = content.replace(/emerald-950\/30/g, 'financy-success/20');
    content = content.replace(/emerald-50/g, 'financy-success/10');
    content = content.replace(/emerald-100/g, 'financy-success/20');
    
    // Geometry logic
    content = content.replace(/rounded-2xl/g, 'rounded-[32px]');
    content = content.replace(/rounded-xl/g, 'rounded-[24px]');
    content = content.replace(/rounded-3xl/g, 'rounded-[40px]');
    
    // Typography logic
    content = content.replace(/className="/g, 'className="font-jakarta ');
    content = content.replace(/className=`/g, 'className={`font-jakarta ');

    fs.writeFileSync(file, content);
    console.log('Updated ' + file);
  }
});

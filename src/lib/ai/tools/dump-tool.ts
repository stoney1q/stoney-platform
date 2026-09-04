import { Project } from 'ts-morph';
const project = new Project();
project.addSourceFilesAtPaths('node_modules/ai/dist/index.d.ts');
const sourceFile = project.getSourceFileOrThrow('node_modules/ai/dist/index.d.ts');
const func = sourceFile.getTypeAlias('ToolExecuteFunction');
if (func) console.log('--- ToolExecuteFunction ---', func.getText());
const toolInterface = sourceFile.getInterface('Tool') || sourceFile.getTypeAlias('Tool');
if (toolInterface) console.log('--- Tool ---', toolInterface.getText());

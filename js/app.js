const { useState, useEffect, useRef } = React;

// --- Configurações de Redimensionamento ---
const RESIZE_OPTIONS = [
    { id: 'none', label: 'Original (Sem redimensionar)', w: null, h: null },
    { id: 'small', label: 'Pequeno (854 x 480)', w: 854, h: 480 },
    { id: 'medium', label: 'Médio (1366 x 768)', w: 1366, h: 768 },
    { id: 'large', label: 'Grande (1920 x 1080)', w: 1920, h: 1080 },
    { id: 'phone', label: 'Telefone (320 x 568)', w: 320, h: 568 },
    { id: 'social', label: 'LinkedIn/EmailMkt (1200 x 630)', w: 1200, h: 630 },
];

// Utilitários
const formatBytes = (bytes, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

const getFormatColor = (format) => {
    switch(format) {
        case 'avif': return 'bg-pink-100 text-pink-700 border-pink-200 dark:bg-pink-500/10 dark:text-pink-400 dark:border-pink-500/20';
        case 'webp': return 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/20';
        case 'jpeg': return 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:text-sky-400 dark:border-sky-500/20';
        case 'png': return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20';
        default: return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600';
    }
};

const App = () => {
    // State
    const [files, setFiles] = useState([]); 
    const [quality, setQuality] = useState(0.8);
    const [targetFormat, setTargetFormat] = useState('original');
    const [resizeOption, setResizeOption] = useState('none');
    const [isProcessing, setIsProcessing] = useState(false);
    const [dragActive, setDragActive] = useState(false);
    
    // Theme State
    const [theme, setTheme] = useState(() => {
        if (typeof window !== 'undefined') return localStorage.getItem('theme') || 'system';
        return 'system';
    });

    // Theme Effect
    useEffect(() => {
        const root = window.document.documentElement;
        const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
        if (isDark) root.classList.add('dark');
        else root.classList.remove('dark');
        localStorage.setItem('theme', theme);
        lucide.createIcons();
    }, [theme]);

    useEffect(() => { lucide.createIcons(); }, [files, targetFormat, isProcessing]);

    // --- Lógica Principal de Compressão/Redimensionamento ---
    const compressSingleFormat = (file, formatToUse, qualityToUse, resizeId) => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    // Calcular dimensões
                    let width = img.width;
                    let height = img.height;

                    const resizeSettings = RESIZE_OPTIONS.find(r => r.id === resizeId);
                    
                    if (resizeSettings && resizeSettings.id !== 'none') {
                        // Cálculo Proporcional (Aspect Fit)
                        const scale = Math.min(
                            resizeSettings.w / width,
                            resizeSettings.h / height
                        );
                        
                        // Só redimensiona se a imagem for maior que o alvo (opcional, mas comum)
                        // Se quiser forçar redimensionamento mesmo que fique maior (upscale), remova o Math.min(1, ...)
                        // Aqui assumiremos que queremos ajustar ao box, seja upscale ou downscale.
                        width = width * scale;
                        height = height * scale;
                    }

                    canvas.width = width;
                    canvas.height = height;
                    
                    // Usar 'medium' qualidade de filtro para suavizar redimensionamento
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'high';
                    ctx.drawImage(img, 0, 0, width, height);

                    let outputMime = file.type;
                    let outputExt = file.name.split('.').pop();
                    let formatKey = formatToUse;

                    if (formatToUse !== 'original') {
                        outputMime = `image/${formatToUse}`;
                        outputExt = formatToUse === 'jpeg' ? 'jpg' : formatToUse;
                    } else {
                        formatKey = file.type.split('/')[1]; 
                        if (formatKey === 'svg+xml') formatKey = 'svg';
                    }

                    canvas.toBlob((blob) => {
                        if (!blob) { resolve(null); return; }
                        
                        const newFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + `.${outputExt}`, {
                            type: outputMime,
                            lastModified: Date.now(),
                        });

                        resolve({
                            format: formatKey === 'jpeg' ? 'jpg' : formatKey,
                            blob: newFile,
                            size: newFile.size,
                            url: URL.createObjectURL(newFile),
                            width: Math.round(width),
                            height: Math.round(height)
                        });
                    }, outputMime, parseFloat(qualityToUse));
                };
            };
        });
    };

    // Adicionar novos arquivos
    const handleFiles = async (newFiles) => {
        setIsProcessing(true);
        const imageFiles = Array.from(newFiles).filter(file => file.type.startsWith('image/'));
        const newFileObjects = [];

        for (const file of imageFiles) {
            const fileObj = {
                id: Math.random().toString(36).substr(2, 9),
                original: file,
                originalSize: file.size,
                originalPreview: URL.createObjectURL(file),
                versions: {} 
            };

            const result = await compressSingleFormat(file, targetFormat, quality, resizeOption);
            if (result) {
                fileObj.versions[targetFormat === 'original' ? result.format : targetFormat] = result;
            }

            newFileObjects.push(fileObj);
        }

        setFiles(prev => [...prev, ...newFileObjects]);
        setIsProcessing(false);
    };

    // Effect: Atualizar arquivos existentes quando as configurações mudam
    useEffect(() => {
        const updateExistingFiles = async () => {
            if (files.length === 0) return;

            // Precisamos atualizar?
            // Sempre atualizaremos se houver arquivos, para refletir mudanças de quality ou resize imediatamente.
            // Para evitar loops infinitos, precisamos comparar se algo mudou real ou usar um ref, 
            // mas como quality/resize mudam com input do usuário, este useEffect dispara apenas nessas mudanças.
            
            setIsProcessing(true);
            const updatedFiles = [...files];

            for (let i = 0; i < updatedFiles.length; i++) {
                const fileObj = updatedFiles[i];
                
                // 1. Identifica quais formatos essa imagem já tem
                const existingFormats = Object.keys(fileObj.versions);
                
                // 2. Garante que o formato alvo atual esteja na lista de processamento
                const currentTargetKey = targetFormat === 'original' 
                    ? fileObj.original.type.split('/')[1].replace('jpeg','jpg') 
                    : targetFormat;
                
                const formatsToProcess = new Set([...existingFormats, currentTargetKey]);

                // 3. Regera todos os formatos ativos para este arquivo
                for (const fmtKey of formatsToProcess) {
                    // Se o formato for 'original' (key=jpg/png), passamos 'original' para a função
                    // Se for uma conversão explícita (key=webp), passamos 'webp'
                    
                    // Pequena lógica reversa para saber o que pedir ao compressor
                    let requestFormat = fmtKey;
                    
                    // Se a chave for igual ao tipo original, pode ter sido gerado via "Original" ou conversão explicita para o mesmo tipo.
                    // Para simplificar, se a chave for o formato alvo atual, usamos a configuração atual 'targetFormat'.
                    // Se for uma versão antiga (ex: gerou webp, mudou para avif), mantemos 'webp'.
                    
                    if (fmtKey === currentTargetKey) {
                        requestFormat = targetFormat;
                    } else {
                        // Se é um formato antigo que não é o alvo atual, regeneramos ele explicitamente
                        // Ex: tenho 'webp' na lista, mas o alvo agora é 'avif'. Quero atualizar o 'webp' com o novo Resize/Quality.
                        // Cuidado: 'original' não é um formato válido para passar como string se a chave for 'jpg'.
                        // Vamos assumir conversão explicita para regenerações de formatos antigos para garantir consistência.
                        requestFormat = fmtKey === 'jpg' ? 'jpeg' : fmtKey;
                    }

                    const result = await compressSingleFormat(fileObj.original, requestFormat, quality, resizeOption);
                    if (result) {
                        fileObj.versions[result.format] = result;
                    }
                }
            }

            setFiles(updatedFiles);
            setIsProcessing(false);
        };

        // Debounce simples para evitar processamento excessivo no slider
        const timeoutId = setTimeout(() => {
            updateExistingFiles();
        }, 500);

        return () => clearTimeout(timeoutId);

    }, [targetFormat, quality, resizeOption]);

    // Drag/Drop e Downloads
    const handleDrop = (e) => {
        e.preventDefault(); e.stopPropagation(); setDragActive(false);
        if (e.dataTransfer.files?.length > 0) handleFiles(e.dataTransfer.files);
    };
    const handleDrag = (e) => {
        e.preventDefault(); e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
        else if (e.type === "dragleave") setDragActive(false);
    };

    const downloadVersion = (version) => {
        const a = document.createElement('a');
        a.href = version.url;
        a.download = version.blob.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    const downloadAllZip = async () => {
        const zip = new JSZip();
        files.forEach(f => {
            Object.values(f.versions).forEach(v => zip.file(v.blob.name, v.blob));
        });
        const content = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url;
        a.download = "imagens_comprimidas.zip";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    const clearAll = () => setFiles([]);

    return (
        <div className="min-h-screen p-4 md:p-8 flex flex-col items-center max-w-7xl mx-auto transition-colors duration-300">
            
            {/* Header */}
            <header className="w-full flex justify-between items-center mb-8">
                <div className="flex-1"></div>
                <div className="text-center flex-1">
                    <h1 className="text-3xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-purple-600 dark:from-blue-400 dark:to-purple-500 mb-2">
                        Compressor Pro
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm md:text-base">Redimensione, converta e otimize</p>
                </div>
                <div className="flex-1 flex justify-end">
                    <button 
                        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                        className="p-2 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
                    >
                        {theme === 'dark' ? <i data-lucide="sun" className="w-5 h-5"></i> : <i data-lucide="moon" className="w-5 h-5"></i>}
                    </button>
                </div>
            </header>

            {/* Controls Panel */}
            <div className="w-full glass-panel rounded-2xl p-6 mb-8 shadow-lg dark:shadow-none">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                    
                    {/* Quality */}
                    <div>
                        <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">
                            Qualidade: {Math.round(quality * 100)}%
                        </label>
                        <input 
                            type="range" min="0.1" max="1" step="0.1" value={quality}
                            onChange={(e) => setQuality(e.target.value)}
                            className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                        <div className="flex justify-between text-xs text-slate-400 mt-1">
                            <span>Menor</span>
                            <span>Melhor</span>
                        </div>
                    </div>

                    {/* Resize Option (NEW) */}
                    <div>
                        <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">
                            Redimensionar (Max)
                        </label>
                        <div className="relative">
                            <select 
                                value={resizeOption} 
                                onChange={(e) => setResizeOption(e.target.value)}
                                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg p-2.5 text-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
                            >
                                {RESIZE_OPTIONS.map(opt => (
                                    <option key={opt.id} value={opt.id}>{opt.label}</option>
                                ))}
                            </select>
                            <i data-lucide="maximize-2" className="absolute right-3 top-3 w-4 h-4 text-slate-400 pointer-events-none"></i>
                        </div>
                    </div>

                    {/* Format Selector */}
                    <div>
                        <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">
                            Adicionar Formato
                        </label>
                        <div className="relative">
                            <select 
                                value={targetFormat} 
                                onChange={(e) => setTargetFormat(e.target.value)}
                                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg p-2.5 text-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
                            >
                                <option value="original">Original</option>
                                <option value="jpeg">JPEG</option>
                                <option value="png">PNG</option>
                                <option value="webp">WebP</option>
                                <option value="avif">AVIF</option>
                            </select>
                            <i data-lucide="chevron-down" className="absolute right-3 top-3 w-4 h-4 text-slate-400 pointer-events-none"></i>
                        </div>
                    </div>

                </div>
            </div>

            {/* Dropzone */}
            <div 
                className={`w-full h-32 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center transition-all cursor-pointer mb-8
                    ${dragActive 
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 scale-[1.01]' 
                        : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/30'}
                `}
                onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
                onClick={() => document.getElementById('file-input').click()}
            >
                <i data-lucide="upload-cloud" className={`w-8 h-8 mb-2 ${dragActive ? 'text-blue-500' : 'text-slate-400'}`}></i>
                <p className="text-base font-medium text-slate-700 dark:text-slate-200">
                    Arraste imagens ou clique aqui
                </p>
                <input id="file-input" type="file" multiple accept="image/*" className="hidden" onChange={(e) => handleFiles(e.target.files)} />
            </div>

            {/* Results List */}
            {files.length > 0 && (
                <div className="w-full space-y-4">
                    <div className="flex justify-between items-center px-1">
                        <h2 className="text-lg font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                            <i data-lucide="image" className="w-5 h-5"></i>
                            Galeria ({files.length})
                        </h2>
                        <button onClick={clearAll} className="text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
                            <i data-lucide="trash-2" className="w-4 h-4"></i> Limpar
                        </button>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        {files.map((file) => (
                            <div key={file.id} className="glass-panel p-4 rounded-xl flex flex-col md:flex-row items-start md:items-center gap-6 shadow-sm">
                                
                                {/* Original Info */}
                                <div className="flex items-center gap-4 w-full md:w-1/4 min-w-[220px] border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-700 pb-4 md:pb-0 md:pr-4">
                                    <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden flex-shrink-0 border border-slate-200 dark:border-slate-700 shadow-sm relative group">
                                        <img src={file.originalPreview} alt="Original" className="w-full h-full object-cover" />
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="font-medium text-sm text-slate-900 dark:text-white truncate" title={file.original.name}>
                                            {file.original.name}
                                        </h3>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                            Original: {formatBytes(file.originalSize)}
                                        </p>
                                        {/* Mostra dimensão original se disponível (precisaria ler ao carregar, simplificado aqui) */}
                                    </div>
                                </div>

                                {/* Generated Versions */}
                                <div className="flex-grow w-full overflow-x-auto pb-2 md:pb-0">
                                    <div className="flex gap-3 items-center">
                                        {Object.entries(file.versions).map(([fmt, version]) => {
                                            const saved = file.originalSize - version.size;
                                            const savedPercent = ((saved / file.originalSize) * 100).toFixed(0);
                                            const isPositive = saved > 0;
                                            const colorClass = getFormatColor(fmt);

                                            return (
                                                <div key={fmt} className={`flex-shrink-0 flex items-center justify-between p-3 rounded-xl border ${colorClass} bg-opacity-50 dark:bg-opacity-10 w-52 transition-all`}>
                                                    <div className="flex flex-col min-w-0">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="text-xs font-bold uppercase tracking-wider">{fmt}</span>
                                                            {isPositive && (
                                                                <span className="text-[10px] bg-white/50 dark:bg-black/20 px-1.5 rounded-full font-bold">
                                                                    -{savedPercent}%
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="text-xs opacity-80 mb-0.5 truncate">
                                                            {version.width}x{version.height}px
                                                        </div>
                                                        <span className="text-sm font-semibold">{formatBytes(version.size)}</span>
                                                    </div>
                                                    <button 
                                                        onClick={() => downloadVersion(version)}
                                                        className="ml-2 p-2 rounded-lg bg-white/80 dark:bg-black/20 hover:bg-white dark:hover:bg-black/40 transition-colors shadow-sm"
                                                        title="Baixar"
                                                    >
                                                        <i data-lucide="download" className="w-4 h-4"></i>
                                                    </button>
                                                </div>
                                            );
                                        })}
                                        {Object.keys(file.versions).length < 2 && (
                                            <div className="text-xs text-slate-400 dark:text-slate-500 italic ml-2 border-l border-slate-200 dark:border-slate-700 pl-4">
                                                Adicione formatos<br/>para comparar
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="sticky bottom-6 mt-6 flex justify-center pointer-events-none">
                        <button 
                            onClick={downloadAllZip}
                            className="pointer-events-auto bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-full shadow-lg shadow-blue-500/30 flex items-center gap-2 font-semibold text-lg transform hover:scale-105 transition-all"
                        >
                            <i data-lucide="archive" className="w-5 h-5"></i>
                            Baixar Tudo (.ZIP)
                        </button>
                    </div>
                </div>
            )}

            {isProcessing && (
                <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-2xl flex flex-col items-center border border-slate-200 dark:border-slate-700">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mb-4"></div>
                        <p className="text-slate-800 dark:text-white font-medium">Processando...</p>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Redimensionando e Otimizando</p>
                    </div>
                </div>
            )}

            <footer className="mt-auto py-8 text-center text-sm text-slate-400 dark:text-slate-500">
                <p>Ajustes de tamanho e qualidade são aplicados automaticamente a todas as versões.</p>
            </footer>

        </div>
    );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);

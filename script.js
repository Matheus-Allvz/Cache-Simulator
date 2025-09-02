document.addEventListener('DOMContentLoaded', () => {
    // --- CONFIGURAÇÕES GLOBAIS ---
    const RAM_SIZE = 64;
    const SET_ASSOCIATIVITY = 2;

    // --- DEFINIÇÃO DOS PROGRAMAS ---
    const programs = {
        sum_sub: {
            steps: [
                { op: 'READ', addr: 10, reg: 'R1', desc: 'READ R1, [10]' },
                { op: 'READ', addr: 11, reg: 'R2', desc: 'READ R2, [11]' },
                { op: 'EXEC', type: 'ADD', dest: 'R1', src: 'R2', desc: 'ADD R1, R2' },
                { op: 'WRITE', addr: 5, reg: 'R1', desc: 'WRITE [5], R1' },
                { op: 'READ', addr: 20, reg: 'R1', desc: 'READ R1, [20]' },
                { op: 'READ', addr: 21, reg: 'R2', desc: 'READ R2, [21]' },
                { op: 'EXEC', type: 'SUB', dest: 'R1', src: 'R2', desc: 'SUB R1, R2' },
                { op: 'WRITE', addr: 6, reg: 'R1', desc: 'WRITE [6], R1' },
            ],
            initialData: [
                { addr: 10, value: 50 }, { addr: 11, value: 25 },
                { addr: 20, value: 100 }, { addr: 21, value: 30 }
            ],
            getUsedAddresses: () => [5, 6, 10, 11, 20, 21]
        },
        loop: {
            steps: [
                { op: 'WRITE', addr: 30, value: 0, desc: 'WRITE [30], 0' },
                ...Array.from({ length: 5 }, (_, i) => i + 40).flatMap(addr => [
                    { op: 'READ', addr: 30, reg: 'R1', desc: `READ R1, [30]` },
                    { op: 'READ', addr: addr, reg: 'R2', desc: `READ R2, [${addr}]` },
                    { op: 'EXEC', type: 'ADD', dest: 'R1', src: 'R2', desc: `ADD R1, R2` },
                    { op: 'WRITE', addr: 30, reg: 'R1', desc: `WRITE [30], R1` },
                ])
            ],
            initialData: [
                { addr: 40, value: 10 }, { addr: 41, value: 20 },
                { addr: 42, value: 30 }, { addr: 43, value: 40 },
                { addr: 44, value: 50 }
            ],
            getUsedAddresses: () => [30, 40, 41, 42, 43, 44]
        },
        multiplication: {
            steps: [
                { op: 'READ', addr: 25, reg: 'R1', desc: 'READ R1, [25]' },
                { op: 'READ', addr: 26, reg: 'R2', desc: 'READ R2, [26]' },
                { op: 'EXEC', type: 'MUL', dest: 'R1', src: 'R2', desc: 'MUL R1, R2' },
                { op: 'WRITE', addr: 15, reg: 'R1', desc: 'WRITE [15], R1' },
            ],
            initialData: [
                { addr: 25, value: 7 }, { addr: 26, value: 6 }
            ],
            getUsedAddresses: () => [15, 25, 26]
        },
        direct_conflict: {
            description: `; Força conflitos no Mapeamento Direto.\n; Acessa endereços que mapeiam\n; para o mesmo índice na L1.\n\nREAD R1, [0]\nREAD R1, [8]\nREAD R1, [0]\nREAD R1, [8]\nREAD R1, [16]\nREAD R1, [24]`,
            steps: [
                { op: 'READ', addr: 0, reg: 'R1', desc: 'READ R1, [0]' },
                { op: 'READ', addr: 8, reg: 'R1', desc: 'READ R1, [8]' },
                { op: 'READ', addr: 0, reg: 'R1', desc: 'READ R1, [0]' },
                { op: 'READ', addr: 8, reg: 'R1', desc: 'READ R1, [8]' },
                { op: 'READ', addr: 16, reg: 'R1', desc: 'READ R1, [16]' },
                { op: 'READ', addr: 24, reg: 'R1', desc: 'READ R1, [24]' },
            ],
            initialData: [
                { addr: 0, value: 111 }, { addr: 8, value: 222 },
                { addr: 16, value: 333 }, { addr: 24, value: 444 }
            ],
            getUsedAddresses: () => [0, 8, 16, 24]
        },
        set_conflict: {
            description: `; Força conflitos no Mapeamento\n; Conjunto-Associativo (2 Vias).\n; Acessa 3 endereços que mapeiam\n; para o mesmo conjunto na L1.\n\nREAD R1, [0]\nREAD R1, [4]\nREAD R1, [8]`,
            steps: [
                { op: 'READ', addr: 0, reg: 'R1', desc: 'READ R1, [0]' },
                { op: 'READ', addr: 4, reg: 'R1', desc: 'READ R1, [4]' },
                { op: 'READ', addr: 8, reg: 'R1', desc: 'READ R1, [8]' },
            ],
            initialData: [
                { addr: 0, value: 111 }, { addr: 4, value: 222 }, { addr: 8, value: 333 }
            ],
            getUsedAddresses: () => [0, 4, 8]
        }
    };

    // --- ELEMENTOS DA UI ---
    const ui = {
        l1: { display: document.getElementById('l1-cache-display'), title: document.getElementById('l1-title'), sizeInput: document.getElementById('l1-size') },
        l2: { display: document.getElementById('l2-cache-display'), title: document.getElementById('l2-title'), sizeInput: document.getElementById('l2-size') },
        l3: { display: document.getElementById('l3-cache-display'), title: document.getElementById('l3-title'), sizeInput: document.getElementById('l3-size') },
        ram: document.getElementById('ram-display'),
        log: document.getElementById('log-console'),
        program: document.getElementById('program-display'),
        cpu: {
            pc: document.getElementById('cpu-pc'),
            ir: document.getElementById('cpu-ir'),
            mar: document.getElementById('cpu-mar'),
            mbr: document.getElementById('cpu-mbr'),
            r1: document.getElementById('cpu-r1'),
            r2: document.getElementById('cpu-r2'),
        },
        prepareBtn: document.getElementById('prepare-simulation'),
        nextStepBtn: document.getElementById('next-step'),
        mappingSelect: document.getElementById('mapping-policy'),
        replacementSelect: document.getElementById('replacement-policy'),
        programSelect: document.getElementById('program-selection'),
        speedSlider: document.getElementById('speed-slider'),
        speedLabel: document.getElementById('speed-label'),
    };

    // --- ESTADO DA SIMULAÇÃO ---
    let ram, l1, l2, l3, cpu;
    let time = 0;
    let recentlyUpdatedBlocks = [];
    let simulationSteps = [];
    let simulationSpeed = 400;

    // --- CLASSES ---

    class Cache {
        constructor(size, associativity, replacementPolicy, name) {
            this.size = size;
            this.associativity = associativity;
            this.replacementPolicy = replacementPolicy;
            this.name = name;
            this.initCache();
        }

        initCache() {
            this.sets = {};
            const numSets = this.getNumSets();
            for (let i = 0; i < numSets; i++) {
                this.sets[i] = [];
            }
        }

        getNumSets() {
            if (this.associativity === 'direct') return this.size;
            if (this.associativity === 'associative') return 1;
            return this.size / this.associativity;
        }

        getSetIndex(address) {
            const numSets = this.getNumSets();
            if (this.associativity === 'associative') return 0;
            return address % numSets;
        }

        getTag(address) {
            const numSets = this.getNumSets();
            if (this.associativity === 'associative') return address;
            return Math.floor(address / numSets);
        }

        fillWithEmptyBlocks() {
            const numSets = this.getNumSets();
            const blocksPerSet = this.size / numSets;
            for (let i = 0; i < numSets; i++) {
                this.sets[i] = [];
                for (let j = 0; j < blocksPerSet; j++) {
                    this.sets[i].push({ valid: false, tag: null, data: null, timestamp: 0, lastUsed: 0 });
                }
            }
        }

        findBlock(address) {
            const setIndex = this.getSetIndex(address);
            const tag = this.getTag(address);
            const set = this.sets[setIndex];
            for (let i = 0; i < set.length; i++) {
                if (set[i].valid && set[i].tag === tag) {
                    return { hit: true, block: set[i], setIndex, blockIndex: i };
                }
            }
            return { hit: false, block: null, setIndex, blockIndex: -1 };
        }

        read(address) {
            const { hit, block, setIndex, blockIndex } = this.findBlock(address);
            if (hit) {
                log(`${this.name}: Hit no endereço ${address}`, 'hit');
                this.updateMetadata(block, setIndex, blockIndex);
                return block.data;
            }
            log(`${this.name}: Miss no endereço ${address}`, 'miss');
            return null;
        }

        write(address, data) {
            const { setIndex } = this.findBlock(address);
            const tag = this.getTag(address);
            let set = this.sets[setIndex];
            let blockToWrite = set.find(b => !b.valid) || this.getBlockToReplace(set);
            const blockIndex = set.indexOf(blockToWrite);
            this.updateBlock(blockToWrite, tag, data);
            registerUpdate(this.name, setIndex, blockIndex);
        }

        updateBlock(block, tag, data) {
            block.valid = true;
            block.tag = tag;
            block.data = data;
            block.timestamp = time++;
            block.lastUsed = time++;
        }

        updateMetadata(block, setIndex, blockIndex) {
            block.lastUsed = time++;
            registerUpdate(this.name, setIndex, blockIndex);
        }

        getBlockToReplace(set) {
            switch (this.replacementPolicy) {
                case 'lru':
                    return set.reduce((a, b) => a.lastUsed < b.lastUsed ? a : b);
                case 'fifo':
                    return set.reduce((a, b) => a.timestamp < b.timestamp ? a : b);
                case 'random':
                    return set[Math.floor(Math.random() * set.length)];
                default:
                    return set[0];
            }
        }
    }

    class CPU {
        constructor(l1, l2, l3, ram) {
            this.l1 = l1;
            this.l2 = l2;
            this.l3 = l3;
            this.ram = ram;
            this.reset();
        }

        reset() {
            this.pc = 0;
            this.ir = null;
            this.mar = 0;
            this.mbr = 0;
            this.gpr = { R1: 0, R2: 0 };
            this.updateDisplay();
        }

        updateDisplay() {
            ui.cpu.pc.textContent = this.pc.toString().padStart(3, '0');
            ui.cpu.ir.textContent = this.ir ? this.ir.desc : '-';
            ui.cpu.mar.textContent = this.mar;
            ui.cpu.mbr.textContent = this.mbr;
            ui.cpu.r1.textContent = this.gpr.R1;
            ui.cpu.r2.textContent = this.gpr.R2;
        }

        async readData(address) {
            this.mar = address;
            this.updateDisplay();
            log(`CPU: Endereço ${address} movido para MAR para operação de leitura`, 'info');
            await delay();

            let data = this.l1.read(this.mar);
            if (data !== null) {
                this.mbr = data;
                this.updateDisplay();
                log(`L1 HIT: Dado ${this.mbr} movido da Cache L1 para o MBR.`, 'info');
                await delay();
                return;
            }

            data = this.l2.read(this.mar);
            if (data !== null) {
                log(`L2 HIT: Dado ${data} encontrado na L2. Propagando para L1...`, 'info');
                this.l1.write(this.mar, data);
                renderAll();
                await delay();

                this.mbr = data;
                this.updateDisplay();
                log(`CPU: Dado ${this.mbr} movido da Cache L1 para o MBR.`, 'info');
                await delay();
                return;
            }

            data = this.l3.read(this.mar);
            if (data !== null) {
                log(`L3 HIT: Dado ${data} encontrado na L3. Propagando para níveis superiores...`, 'info');
                this.l2.write(this.mar, data);
                log(`Propagado para Cache L2.`, 'info');
                renderAll();
                await delay();
                this.l1.write(this.mar, data);
                log(`Propagado para Cache L1.`, 'info');
                renderAll();
                await delay();

                this.mbr = data;
                this.updateDisplay();
                log(`CPU: Dado ${this.mbr} movido da Cache L1 para o MBR.`, 'info');
                await delay();
                return;
            }

            log(`RAM: Acessando endereço ${this.mar} na Memória Principal.`, 'ram');
            data = this.ram[this.mar];
            log(`RAM FETCH: Dado ${data} encontrado. Propagando para a hierarquia de cache...`, 'info');
            await delay();

            this.l3.write(this.mar, data);
            log(`Propagado para Cache L3.`, 'info');
            renderAll();
            await delay();

            this.l2.write(this.mar, data);
            log(`Propagado para Cache L2.`, 'info');
            renderAll();
            await delay();

            this.l1.write(this.mar, data);
            log(`Propagado para Cache L1.`, 'info');
            renderAll();
            await delay();

            this.mbr = data;
            this.updateDisplay();
            log(`CPU: Dado ${this.mbr} movido da Cache L1 para o MBR.`, 'info');
            await delay();
        }

        async writeData(address, value) {
            this.mar = address;
            this.mbr = value;
            this.updateDisplay();
            log(`CPU: Endereço ${address} para MAR, Dado ${value} para MBR para operação de escrita`, 'info');
            await delay();

            log(`CPU -> Escrevendo dado do MBR para a Cache L1...`, 'info');
            this.l1.write(this.mar, this.mbr);
            renderAll();
            await delay();

            log(`CPU -> Propagando escrita para a Cache L2 (Política Write-Through)...`, 'info');
            this.l2.write(this.mar, this.mbr);
            renderAll();
            await delay();

            log(`CPU -> Propagando escrita para a Cache L3 (Política Write-Through)...`, 'info');
            this.l3.write(this.mar, this.mbr);
            renderAll();
            await delay();

            log(`CPU -> Propagando escrita para a Memória RAM (Política Write-Through)...`, 'info');
            this.ram[this.mar] = this.mbr;
            renderAll();
            await delay();
        }
    }

    // --- FUNÇÕES DE SIMULAÇÃO ---

    function initialize() {
        const l1Size = parseInt(ui.l1.sizeInput.value);
        const l2Size = parseInt(ui.l2.sizeInput.value);
        const l3Size = parseInt(ui.l3.sizeInput.value);

        ui.l1.title.textContent = `Cache L1 (${l1Size} Linhas)`;
        ui.l2.title.textContent = `Cache L2 (${l2Size} Linhas)`;
        ui.l3.title.textContent = `Cache L3 (${l3Size} Linhas)`;

        ram = Array(RAM_SIZE).fill(0);
        const selectedProgram = programs[ui.programSelect.value];
        if (selectedProgram.initialData) {
            selectedProgram.initialData.forEach(item => {
                ram[item.addr] = item.value;
            });
        }

        const mapping = ui.mappingSelect.value;
        const replacement = ui.replacementSelect.value;
        let assoc = (mapping === 'direct' || mapping === 'associative') ? mapping : SET_ASSOCIATIVITY;

        l1 = new Cache(l1Size, assoc, replacement, 'L1');
        l2 = new Cache(l2Size, assoc, replacement, 'L2');
        l3 = new Cache(l3Size, assoc, replacement, 'L3');
        [l1, l2, l3].forEach(c => c.fillWithEmptyBlocks());

        cpu = new CPU(l1, l2, l3, ram);
        time = 0;
        recentlyUpdatedBlocks = [];
        simulationSteps = [];

        ui.log.innerHTML = '';
        log('Simulação pronta. Pressione "Preparar" para carregar um programa.', 'info');
        ui.nextStepBtn.disabled = true;
        renderAll();
    }

    function prepareSimulation() {
        initialize();
        const programKey = ui.programSelect.value;
        simulationSteps = programs[programKey].steps;
        log(`Programa "${programKey}" carregado. Pressione "Próximo Passo".`, 'op');
        ui.nextStepBtn.disabled = false;
        updateProgramDisplay();
        cpu.updateDisplay();
    }

    async function executeNextStep() {
        if (cpu.pc >= simulationSteps.length) return;
        ui.nextStepBtn.disabled = true;

        log(`--- Iniciando Ciclo da Instrução ${cpu.pc} ---`, 'op');
        cpu.ir = simulationSteps[cpu.pc];
        cpu.updateDisplay();
        log(`FETCH: Instrução "${cpu.ir.desc}" movida para IR. PC aponta para ${cpu.pc + 1}.`, 'info');
        updateProgramDisplay();
        await delay();

        const step = cpu.ir;
        switch (step.op) {
            case 'READ':
                await cpu.readData(step.addr);
                cpu.gpr[step.reg] = cpu.mbr;
                log(`CPU: Dado ${cpu.mbr} do MBR movido para registrador ${step.reg}.`, 'info');
                cpu.updateDisplay();
                await delay();
                break;
            case 'WRITE':
                const value = step.value !== undefined ? step.value : cpu.gpr[step.reg];
                await cpu.writeData(step.addr, value);
                break;
            case 'EXEC':
                const valDest = cpu.gpr[step.dest];
                const valSrc = cpu.gpr[step.src];
                if (step.type === 'ADD') cpu.gpr[step.dest] = valDest + valSrc;
                if (step.type === 'SUB') cpu.gpr[step.dest] = valDest - valSrc;
                if (step.type === 'MUL') cpu.gpr[step.dest] = valDest * valSrc;
                log(`EXEC: ${step.type} executado. ${step.dest} = ${cpu.gpr[step.dest]}.`, 'info');
                break;
        }

        cpu.pc++;
        if (cpu.pc < simulationSteps.length) {
            cpu.ir = null;
        }
        renderAll();
        cpu.updateDisplay();
        updateProgramDisplay();

        if (cpu.pc >= simulationSteps.length) {
            log("Fim do programa.", "op");
        } else {
            ui.nextStepBtn.disabled = false;
        }
    }

    // --- FUNÇÕES DE RENDERIZAÇÃO E UTILITÁRIOS ---

    function registerUpdate(cacheName, setIndex, blockIndex) {
        const id = `${cacheName}-${setIndex}-${blockIndex}`;
        recentlyUpdatedBlocks = recentlyUpdatedBlocks.filter(item => item.id !== id);
        recentlyUpdatedBlocks.unshift({ id, cacheName, setIndex, blockIndex });
        if (recentlyUpdatedBlocks.length > 3) {
            recentlyUpdatedBlocks.pop();
        }
    }

    function renderCache(display, cache) {
        display.innerHTML = '';
        for (const setIndex in cache.sets) {
            const set = cache.sets[setIndex];
            if (cache.associativity !== 'direct' && cache.associativity !== 'associative') {
                const label = document.createElement('div');
                label.className = 'cache-set-label';
                label.textContent = `Conj. ${setIndex}:`;
                display.appendChild(label);
            }
            set.forEach((block, blockIndex) => {
                const line = document.createElement('div');
                line.className = 'cache-line';
                const id = `${cache.name}-${setIndex}-${blockIndex}`;
                const updateInfo = recentlyUpdatedBlocks.findIndex(item => item.id === id);
                if (updateInfo !== -1) {
                    line.classList.add(`updated-${updateInfo + 1}`);
                }
                const index = cache.associativity === 'direct' ? setIndex : blockIndex;
                line.textContent = ` ${index.toString().padStart(2, ' ')}:[V:${block.valid ? 1:0}, T:${(block.tag ?? '-').toString().padStart(3,' ')}, D:${(block.data ?? '-').toString().padStart(4,' ')}]`;
                display.appendChild(line);
});
        }
    }

    function renderRam(highlightedAddresses = []) {
        ui.ram.innerHTML = '';
        for (let i = 0; i < RAM_SIZE; i++) {
            const cell = document.createElement('div');
            cell.classList.add('ram-cell');
            if (highlightedAddresses.includes(i)) {
                cell.classList.add('highlight');
            }
            cell.textContent = `[${i.toString().padStart(2, ' ')}]: ${ram[i].toString().padStart(4, ' ')}`;
            ui.ram.appendChild(cell);
        }
    }

    function updateProgramDisplay() {
        ui.program.innerHTML = '';
        const programKey = ui.programSelect.value;
        const steps = programs[programKey].steps;
        steps.forEach((step, index) => {
            const line = document.createElement('div');
            line.className = 'program-line';
            if (index === cpu.pc) {
                line.classList.add('active');
            }
            line.textContent = `${index.toString().padStart(3, '0')}: ${step.desc}`;
            ui.program.appendChild(line);
        });
    }

    function renderAll() {
        renderCache(ui.l1.display, l1);
        renderCache(ui.l2.display, l2);
        renderCache(ui.l3.display, l3);
        const usedAddresses = programs[ui.programSelect.value].getUsedAddresses();
        renderRam(usedAddresses);
    }

    function log(message, type) {
        const p = document.createElement('p');
        p.textContent = `[${(time++).toString().padStart(3, '0')}] ${message}`;
        p.className = `log-${type}`;
        ui.log.appendChild(p);
        ui.log.scrollTop = ui.log.scrollHeight;
    }

    const delay = () => new Promise(resolve => setTimeout(resolve, simulationSpeed));

    // --- EVENT LISTENERS ---
    ui.prepareBtn.addEventListener('click', prepareSimulation);
    ui.nextStepBtn.addEventListener('click', executeNextStep);

    [ui.programSelect, ui.mappingSelect, ui.replacementSelect, ui.l1.sizeInput, ui.l2.sizeInput, ui.l3.sizeInput]
    .forEach(el => el.addEventListener('change', initialize));

    ui.speedSlider.addEventListener('input', (e) => {
        // Inverte o valor para que "direita" seja mais rápido
        simulationSpeed = 1050 - e.target.value;
        if (simulationSpeed > 800) ui.speedLabel.textContent = 'Lento';
        else if (simulationSpeed > 500) ui.speedLabel.textContent = 'Normal';
        else if (simulationSpeed > 200) ui.speedLabel.textContent = 'Rápido';
        else ui.speedLabel.textContent = 'Turbo';
    });

    // --- INICIALIZAÇÃO ---
    initialize();
});
class SnakeGamePro {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Estado
        this.mode = 'NEON';
        this.active = false;
        this.paused = false;
        this.muted = false;
        this.score = 0;
        this.timer = 0;
        this.snakeColor = 180;
        this.best = localStorage.getItem('snk_v8_best') || 0;
        
        // Performance e Assets
        this.dir = 'RIGHT';
        this.dirQueue = [];
        this.lastFrame = 0;
        this.konami = [];
        this.keys = new Set();
        
        // Carregamento de Assets PNG
        this.assets = {
            nyanHead: new Image()
        };
        this.assets.nyanHead.src = 'assets/nyan-head.png';

        this.audio = {
            menu_neon: new Audio('assets/menu_neon.mp3'),
            game_neon: new Audio('assets/game_neon.mp3'),
            menu_nyan: new Audio('assets/menu_nyan.mp3'),
            game_nyan: new Audio('assets/game_nyan.mp3'),
            eat: new Audio('assets/comer.mp3'),
            win: new Audio('assets/vitoria.mp3'),
            click: new Audio('assets/clique_menu.mp3')
        };

        this.init();
    }

    init() {
        document.getElementById('start-btn').onclick = () => this.boot();
        document.getElementById('retry-btn').onclick = () => this.boot();
        document.getElementById('home-btn').onclick = () => this.showOverlay('menu-screen');
        document.getElementById('mute-btn').onclick = () => this.toggleMute();

        window.onkeydown = (e) => this.handleInput(e);
        window.onkeyup = (e) => this.keys.delete(e.key);

        this.setupMobile();
        this.updateHUD();
        this.manageMusic();
        
        requestAnimationFrame((t) => this.gameLoop(t));
    }

    setupMobile() {
        if (/Android|iPhone|iPad/i.test(navigator.userAgent)) {
            document.getElementById('dpad').classList.remove('hidden');
            ['UP', 'DOWN', 'LEFT', 'RIGHT'].forEach(d => {
                document.getElementById(`btn-${d}`).ontouchstart = (e) => {
                    e.preventDefault();
                    this.pushDir(d);
                };
            });
        }
    }

    handleInput(e) {
        this.keys.add(e.key);
        this.konami.push(e.key);
        if(this.konami.length > 20) this.konami.shift();

        const k = this.konami.join(',');
        const combo = "ArrowUp,ArrowUp,ArrowDown,ArrowDown,ArrowLeft,ArrowRight,ArrowLeft,ArrowRight";
        if(k.includes(combo) && this.keys.has('Backspace') && this.keys.has('Delete')) {
            this.triggerNyan();
        }

        if(e.key === 'Enter') this.active ? this.togglePause() : this.boot();
        const moves = { ArrowUp:'UP', w:'UP', ArrowDown:'DOWN', s:'DOWN', ArrowLeft:'LEFT', a:'LEFT', ArrowRight:'RIGHT', d:'RIGHT' };
        if(moves[e.key]) this.pushDir(moves[e.key]);
    }

    pushDir(newDir) {
        const last = this.dirQueue.length > 0 ? this.dirQueue[this.dirQueue.length - 1] : this.dir;
        const opp = { UP:'DOWN', DOWN:'UP', LEFT:'RIGHT', RIGHT:'LEFT' };
        if(newDir !== last && newDir !== opp[last]) {
            if(this.dirQueue.length < 2) this.dirQueue.push(newDir);
        }
    }

    triggerNyan() {
        this.mode = 'NYAN';
        document.body.className = 'nyan-theme';
        document.getElementById('game-title').innerHTML = 'NYAN <span class="nyan-glow">SNAKE! 🍭</span>';
        document.getElementById('nyan-bg-deco').classList.remove('hidden');
        document.getElementById('nyan-alert').classList.remove('hidden');
        this.playSfx('win');
        this.manageMusic();
    }

    boot() {
        const [c, r] = document.getElementById('map-size').value.split(',').map(Number);
        this.grid = { c, r, total: c * r };
        this.speed = Number(document.getElementById('speed').value);
        
        const view = document.getElementById('viewport');
        this.ts = Math.floor(Math.min((view.clientWidth-30)/c, (view.clientHeight-30)/r));
        this.canvas.width = c * this.ts;
        this.canvas.height = r * this.ts;

        this.snake = [{x: Math.floor(c/2), y: Math.floor(r/2)}, {x: Math.floor(c/2)-1, y: Math.floor(r/2)}];
        this.dir = 'RIGHT';
        this.dirQueue = [];
        this.score = 0; this.timer = 0;
        this.active = true; this.paused = false;

        this.spawnFood();
        this.showOverlay(null);
        this.manageMusic();

        if(this.clock) clearInterval(this.clock);
        this.clock = setInterval(() => { if(!this.paused && this.active) this.timer++; this.updateHUD(); }, 1000);
    }

    spawnFood() {
        this.food = { x: Math.floor(Math.random()*this.grid.c), y: Math.floor(Math.random()*this.grid.r) };
        if(this.snake.some(s => s.x === this.food.x && s.y === this.food.y)) this.spawnFood();
    }

    gameLoop(t) {
        if(this.active && !this.paused) {
            if(t - this.lastFrame > this.speed) {
                this.lastFrame = t;
                this.tick();
            }
        }
        this.draw();
        requestAnimationFrame((ts) => this.gameLoop(ts));
    }

    tick() {
        if(this.dirQueue.length > 0) this.dir = this.dirQueue.shift();
        const head = { ...this.snake[0] };
        if(this.dir === 'UP') head.y--;
        if(this.dir === 'DOWN') head.y++;
        if(this.dir === 'LEFT') head.x--;
        if(this.dir === 'RIGHT') head.x++;

        if(this.snake.length >= this.grid.total) return this.endGame(true);
        if(head.x < 0 || head.x >= this.grid.c || head.y < 0 || head.y >= this.grid.r || 
           this.snake.some(s => s.x === head.x && s.y === head.y)) return this.endGame(false);

        this.snake.unshift(head);
        if(head.x === this.food.x && head.y === this.food.y) {
            this.score += 10; this.playSfx('eat'); this.spawnFood();
        } else { this.snake.pop(); }
    }

    draw() {
        if(!this.active) return;
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0,0,this.canvas.width, this.canvas.height);

        // Grade HD
        this.ctx.strokeStyle = 'rgba(0, 243, 255, 0.1)';
        for(let i=0; i<=this.grid.c; i++) { this.ctx.beginPath(); this.ctx.moveTo(i*this.ts, 0); this.ctx.lineTo(i*this.ts, this.canvas.height); this.ctx.stroke(); }
        for(let i=0; i<=this.grid.r; i++) { this.ctx.beginPath(); this.ctx.moveTo(0, i*this.ts); this.ctx.lineTo(this.canvas.width, i*this.ts); this.ctx.stroke(); }

        // Comida
        const items = this.mode === 'NYAN' ? ["🍩", "🍫", "🍬"] : ["🍎", "🍇", "🍓"];
        this.ctx.font = `${this.ts * 0.7}px Arial`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(items[this.score % items.length], this.food.x*this.ts + this.ts/2, this.food.y*this.ts + this.ts/2);

        // Snake
        this.snake.forEach((s, i) => {
            if(i === 0 && this.mode === 'NYAN' && this.assets.nyanHead.complete) {
                // Rotação da Cabeça PNG
                this.ctx.save();
                this.ctx.translate(s.x*this.ts + this.ts/2, s.y*this.ts + this.ts/2);
                const angles = { UP: -Math.PI/2, DOWN: Math.PI/2, LEFT: Math.PI, RIGHT: 0 };
                this.ctx.rotate(angles[this.dir]);
                this.ctx.drawImage(this.assets.nyanHead, -this.ts/2, -this.ts/2, this.ts, this.ts);
                this.ctx.restore();
            } else {
                this.ctx.fillStyle = this.mode === 'NYAN' ? `hsl(${i * 20}, 100%, 50%)` : `hsl(${this.snakeColor}, 100%, 50%)`;
                this.ctx.fillRect(s.x*this.ts+1, s.y*this.ts+1, this.ts-2, this.ts-2);
            }
        });
    }

    endGame(win) {
        this.active = false;
        if(this.score > this.best) { this.best = this.score; localStorage.setItem('snk_v8_best', this.best); }
        document.getElementById('end-title').innerText = win ? "VITÓRIA! 🏆" : "FIM DE JOGO";
        document.getElementById('f-score').innerText = this.score;
        this.showOverlay('end-screen');
        if(win) this.playSfx('win');
        this.manageMusic();
    }

    togglePause() { this.paused = !this.paused; document.getElementById('pause-tag').classList.toggle('hidden', !this.paused); this.manageMusic(); }
    toggleMute() { this.muted = !this.muted; document.getElementById('mute-btn').innerText = this.muted ? "🔇" : "🔊"; this.manageMusic(); }
    playSfx(id) { if(!this.muted) { this.audio[id].currentTime = 0; this.audio[id].play().catch(()=>{}); } }
    
    manageMusic() {
        Object.values(this.audio).forEach(a => { if(a.loop) { a.pause(); a.currentTime = 0; } });
        if(this.muted) return;
        const tid = this.active ? `game_${this.mode.toLowerCase()}` : `menu_${this.mode.toLowerCase()}`;
        this.audio[tid].loop = true; this.audio[tid].play().catch(()=>{});
    }

    updateHUD() {
        document.getElementById('best').innerText = this.best;
        document.getElementById('last').innerText = this.score;
        const m = Math.floor(this.timer/60).toString().padStart(2,'0');
        const s = (this.timer%60).toString().padStart(2,'0');
        document.getElementById('timer').innerText = `${m}:${s}`;
    }

    showOverlay(id) {
        document.getElementById('overlay').classList.toggle('hidden', !id);
        document.getElementById('menu-screen').classList.add('hidden');
        document.getElementById('end-screen').classList.add('hidden');
        if(id) document.getElementById(id).classList.remove('hidden');
    }
}
window.onload = () => new SnakeGamePro();
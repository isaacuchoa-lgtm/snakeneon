class SnakeNeonRGB {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.cfg = { hue: 180, rainbow: false, emoji: "🍎", cols: 15, rows: 17, speed: 90, mobile: "dpad" };
        this.state = { active: false, paused: false, over: false, audioOK: false };
        this.inputQueue = [];
        this.audio = {
            enabled: true,
            assets: {
                menu: new Audio('assets/menu-music.mp3'), game: new Audio('assets/game-music.mp3'),
                eat: new Audio('assets/eat.mp3'), click: new Audio('assets/click.mp3')
            }
        };
        this.audio.assets.menu.loop = this.audio.assets.game.loop = true;
        this.history = { best: localStorage.getItem('snk_rgb_best') || 0, last: localStorage.getItem('snk_rgb_last') || 0 };
        this.init();
    }

    init() {
        // Unlock Audio
        const unlock = () => { if(!this.state.audioOK){ this.state.audioOK = true; this.manageAudio(); } };
        window.addEventListener('click', unlock); window.addEventListener('keydown', unlock);

        // Rainbow Toggle
        const rainBtn = document.getElementById('rainbow-btn');
        rainBtn.onclick = () => {
            this.cfg.rainbow = !this.cfg.rainbow;
            rainBtn.classList.toggle('active', this.cfg.rainbow);
            this.playSfx('click');
        };

        document.getElementById('hue-slider').oninput = (e) => { this.cfg.hue = e.target.value; this.playSfx('click'); };
        document.querySelectorAll('.p-btn').forEach(b => b.onclick = () => {
            document.querySelectorAll('.p-btn').forEach(x => x.classList.remove('active'));
            b.classList.add('active'); this.cfg.emoji = b.dataset.emoji; this.playSfx('click');
        });

        document.getElementById('mute-btn').onclick = (e) => {
            this.audio.enabled = !this.audio.enabled;
            e.target.innerText = this.audio.enabled ? "🔊" : "🔇";
            this.manageAudio();
        };

        document.getElementById('start-btn').onclick = () => this.boot();
        document.getElementById('retry-btn').onclick = () => this.boot();
        document.getElementById('home-btn').onclick = () => this.showMenu();

        this.bindKeys();
        this.updateHUD();
    }

    playSfx(n) { if(this.audio.enabled && this.state.audioOK) { const s=this.audio.assets[n]; s.currentTime=0; s.play().catch(()=>{}); } }

    manageAudio() {
        Object.values(this.audio.assets).forEach(a => { if(a.loop) a.pause(); });
        if(!this.audio.enabled || !this.state.audioOK) return;
        (this.state.active && !this.state.paused) ? this.audio.assets.game.play() : this.audio.assets.menu.play();
    }

    bindKeys() {
        window.onkeydown = (e) => {
            const k = e.key.toUpperCase();
            if(k === 'R') this.boot();
            if(k === 'ENTER') this.state.over ? this.showMenu() : (this.state.active ? this.togglePause() : this.boot());
            const dirs = { 'W':'UP','S':'DOWN','A':'LEFT','D':'RIGHT','ARROWUP':'UP','ARROWDOWN':'DOWN','ARROWLEFT':'LEFT','ARROWRIGHT':'RIGHT' };
            if(dirs[k]) this.pushInput(dirs[k]);
        };
        ['up','down','left','right'].forEach(id => document.getElementById(id).onclick = () => this.pushInput(id.toUpperCase()));
    }

    pushInput(dir) {
        const last = this.inputQueue.length > 0 ? this.inputQueue[this.inputQueue.length-1] : this.curDir;
        const opposites = { 'UP':'DOWN','DOWN':'UP','LEFT':'RIGHT','RIGHT':'LEFT' };
        if(dir !== opposites[last] && dir !== last) this.inputQueue.push(dir);
        if(this.inputQueue.length > 2) this.inputQueue.shift();
    }

    togglePause() {
        this.state.paused = !this.state.paused;
        document.getElementById('pause-tag').classList.toggle('hidden', !this.state.paused);
        this.manageAudio();
    }

    showMenu() {
        this.state.active = this.state.over = this.state.paused = false;
        document.querySelectorAll('.ui-panel').forEach(p => p.classList.add('hidden'));
        document.getElementById('overlay').classList.remove('hidden');
        document.getElementById('menu-screen').classList.remove('hidden');
        this.manageAudio();
    }

    boot() {
        clearInterval(this.loop); clearInterval(this.clock);
        const [c, r] = document.getElementById('map-size').value.split(',').map(Number);
        this.cfg.cols = c; this.cfg.rows = r;
        this.cfg.speed = Number(document.getElementById('speed').value);
        this.cfg.mobile = document.getElementById('ctrl-mode').value;
        document.getElementById('dpad').className = this.cfg.mobile === 'dpad' ? 'mobile-ui' : 'mobile-ui hidden';
        
        const area = document.getElementById('viewport');
        this.ts = Math.floor(Math.min((area.clientWidth-20)/c, (area.clientHeight-20)/r));
        this.canvas.width = this.ts * c; this.canvas.height = this.ts * r;

        this.snake = [{x: Math.floor(c/2), y: Math.floor(r/2)}, {x: Math.floor(c/2)-1, y: Math.floor(r/2)}];
        this.dir = {x: 1, y: 0}; this.curDir = 'RIGHT'; this.inputQueue = [];
        this.score = 0; this.startTime = Date.now(); this.state.active = true; this.state.paused = false; this.state.over = false;

        this.spawn();
        document.getElementById('overlay').classList.add('hidden');
        document.getElementById('pause-tag').classList.add('hidden');
        this.manageAudio(); this.updateHUD();
        this.loop = setInterval(() => this.tick(), this.cfg.speed);
        this.clock = setInterval(() => this.updateTimer(), 1000);
    }

    spawn() {
        this.food = { x: Math.floor(Math.random()*this.cfg.cols), y: Math.floor(Math.random()*this.cfg.rows) };
        if(this.snake.some(s => s.x===this.food.x && s.y===this.food.y)) this.spawn();
    }

    updateTimer() {
        if(this.state.paused) return;
        const d = Math.floor((Date.now()-this.startTime)/1000);
        document.getElementById('timer').innerText = `${Math.floor(d/60).toString().padStart(2,'0')}:${(d%60).toString().padStart(2,'0')}`;
    }

    tick() {
        if(this.state.paused) return;
        if(this.inputQueue.length > 0) {
            const n = this.inputQueue.shift(); this.curDir = n;
            this.dir = n==='UP'?{x:0,y:-1}:n==='DOWN'?{x:0,y:1}:n==='LEFT'?{x:-1,y:0}:{x:1,y:0};
        }
        const head = { x: this.snake[0].x + this.dir.x, y: this.snake[0].y + this.dir.y };
        if(head.x<0 || head.x>=this.cfg.cols || head.y<0 || head.y>=this.cfg.rows || this.snake.some(s=>s.x===head.x && s.y===head.y)) return this.end();
        
        this.snake.unshift(head);
        if(head.x===this.food.x && head.y===this.food.y) { this.score+=10; this.playSfx('eat'); this.spawn(); this.updateHUD(); }
        else this.snake.pop();

        if(this.cfg.rainbow) this.cfg.hue = (parseInt(this.cfg.hue) + 5) % 360;
        this.draw();
    }

    draw() {
        this.ctx.fillStyle = "#000"; this.ctx.fillRect(0,0,this.canvas.width,this.canvas.height);
        this.ctx.strokeStyle = "rgba(255,255,255,0.15)";
        for(let i=0; i<=this.cfg.cols; i++) { this.ctx.beginPath(); this.ctx.moveTo(i*this.ts,0); this.ctx.lineTo(i*this.ts,this.canvas.height); this.ctx.stroke(); }
        for(let j=0; j<=this.cfg.rows; j++) { this.ctx.beginPath(); this.ctx.moveTo(0,j*this.ts); this.ctx.lineTo(this.canvas.width,j*this.ts); this.ctx.stroke(); }
        
        this.ctx.font = `${this.ts*0.7}px Arial`; this.ctx.textAlign="center"; this.ctx.textBaseline="middle";
        this.ctx.fillText(this.cfg.emoji, this.food.x*this.ts+this.ts/2, this.food.y*this.ts+this.ts/2);

        this.ctx.fillStyle = `hsl(${this.cfg.hue}, 100%, 50%)`;
        this.ctx.shadowBlur = 15; this.ctx.shadowColor = this.ctx.fillStyle;
        this.snake.forEach(p => this.ctx.fillRect(p.x*this.ts+1, p.y*this.ts+1, this.ts-2, this.ts-2));
        this.ctx.shadowBlur = 0;
    }

    updateHUD() {
        document.getElementById('score').innerText = this.score;
        document.getElementById('best').innerText = this.history.best;
        document.getElementById('last').innerText = this.history.last;
    }

    end() {
        clearInterval(this.loop); clearInterval(this.clock);
        this.state.over = true; this.state.active = false;
        this.history.last = this.score; localStorage.setItem('snk_rgb_last', this.score);
        if(this.score > this.history.best) { this.history.best = this.score; localStorage.setItem('snk_rgb_best', this.score); }
        document.getElementById('f-score').innerText = this.score;
        document.getElementById('f-time').innerText = document.getElementById('timer').innerText;
        document.getElementById('overlay').classList.remove('hidden');
        document.getElementById('menu-screen').classList.add('hidden');
        document.getElementById('over-screen').classList.remove('hidden');
        this.updateHUD(); this.manageAudio();
    }
}
window.onload = () => new SnakeNeonRGB();
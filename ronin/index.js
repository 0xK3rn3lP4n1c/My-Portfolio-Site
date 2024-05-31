const canvas = document.querySelector('canvas')
const c = canvas.getContext('2d')

canvas.width = 1024
canvas.height = 576 //16:9 ratio

c.fillRect(0, 0, canvas.width, canvas.height)

const background = new Sprite({position: {x: 0, y:0}, imageSrc: './img/rotr-bg.png'})
const fire = new Sprite({position: {x: 708, y:165}, imageSrc: './img/fireEffect.png', scale: 8.7, framesMax: 8})

const gravity = 0.7

const player = new Fighter(
    {
        position:{x:0, y:0},
        velocity:{x:0, y:0},
        offset:{x:0, y:0},
        imageSrc: './img/RoninTakashi/Idle.png',
        framesMax: 8,
        scale: 3.5,
        offset: {x: 300 , y:285},
        sprites:
        {
            idle: {imageSrc: './img/RoninTakashi/Idle.png', framesMax: 8},
            run: {imageSrc: './img/RoninTakashi/Run.png', framesMax: 8,},
            jump: {imageSrc: './img/RoninTakashi/Jump.png', framesMax: 2},
            fall: {imageSrc: './img/RoninTakashi/Fall.png', framesMax: 2},
            attack1: {imageSrc: './img/RoninTakashi/Attack1.png', framesMax: 6},
            takeHit: {imageSrc: './img/RoninTakashi/Take Hit - white silhouette.png', framesMax: 4},
            death: {imageSrc: './img/RoninTakashi/Death.png', framesMax: 6}
        },
        attackBox: 
        {
            offset: {x: 100, y:0},
            width: 260,
            height: 50
        }
    })
const enemy = new Fighter(
    {
        position:{x: 974, y:0},
        velocity:{x:0, y:0},
        color: 'Green',
        offset:{x:-50, y:0},
        imageSrc: './img/OnmyojiAshura/Idle.png',
        framesMax: 8,
        scale: 3.2,
        offset: {x: 403, y:390},
        sprites:
        {
            idle: {imageSrc: './img/OnmyojiAshura/Idle.png', framesMax: 8},
            run: {imageSrc: './img/OnmyojiAshura/Run.png', framesMax: 8,},
            jump: {imageSrc: './img/OnmyojiAshura/Jump.png', framesMax: 2},
            fall: {imageSrc: './img/OnmyojiAshura/Fall.png', framesMax: 2},
            attack1: {imageSrc: './img/OnmyojiAshura/Attack1.png', framesMax: 8},
            takeHit: {imageSrc: './img/OnmyojiAshura/Take hit.png', framesMax: 3},
            death: {imageSrc: './img/OnmyojiAshura/Death.png', framesMax: 7}
        },
        attackBox: 
        {
            offset: {x: -330, y:-50},
            width: 270,
            height: 70
        } 
    })


const keys = 
{
    a: 
    {
        pressed: false
    },

    d:
    {
        pressed: false
    },
    ArrowRight:
    {
        pressed: false
    },
    ArrowLeft:
    {
        pressed: false
    }
}

decreaseTimer()

function Animate()
{
    window.requestAnimationFrame(Animate)
    c.fillStyle = 'black'
    c.fillRect(0, 0, canvas.width, canvas.height)
    background.update()
    fire.update()
    c.fillStyle = 'rgba(255, 255, 255, 0.078)'
    c.fillRect(0, 0, canvas.width, canvas.height)
    player.update()
    enemy.update()
    player.velocity.x = 0
    enemy.velocity.x = 0
    //player Movement
    if (keys.a.pressed && player.lastKey === 'a') 
    {
        player.velocity.x = -7
        player.switchSprite('run')
    }
    else if(keys.d.pressed && player.lastKey === 'd')
    {
        player.velocity.x = 7
        player.switchSprite('run')
    }else
    {
        player.switchSprite('idle')
    }

    //JumpPlayer
    if (player.velocity.y < 0) 
    {
        player.switchSprite('jump')   
    }
    else if(player.velocity.y > 0)
    {
        player.switchSprite('fall')
    }

    //enemy Movemet
    if (keys.ArrowLeft.pressed && enemy.lastKey === 'ArrowLeft') 
    {
        enemy.velocity.x = -7
        enemy.switchSprite('run')
    }
    else if(keys.ArrowRight.pressed && enemy.lastKey === 'ArrowRight')
    {
        enemy.velocity.x = 7
        enemy.switchSprite('run')
    }else
    {
        enemy.switchSprite('idle')
    }

    //JumpEnemy
    if (enemy.velocity.y < 0) 
    {
        enemy.switchSprite('jump')   
    }
    else if(enemy.velocity.y > 0)
    {
        enemy.switchSprite('fall')
    }
    
    //Detect Collision
    if (rectangularCollision({rectangle1: player, rectangle2: enemy}) && player.isAttacking && player.framesCurrent === 4) 
    {
        enemy.takeHit()
        player.isAttacking = false
        gsap.to('#enemyHealth',
        {
            width: enemy.health + '%'
        })
    }

    //If Player Miss
    if (player.isAttacking && player.framesCurrent === 4) 
    {
        player.isAttacking = false    
    }

    if (rectangularCollision({rectangle1: enemy, rectangle2: player}) && enemy.isAttacking && enemy.framesCurrent === 4) 
    {
        player.takeHit()
        enemy.isAttacking = false
        gsap.to('#playerHealth',
        {
            width: player.health + '%'
        })
    }

    //If Enemy Miss
    if (enemy.isAttacking && enemy.framesCurrent === 4) 
    {
        enemy.isAttacking = false    
    }

    //End Game
    if (player.health <= 0 || enemy.health <=0) 
    {
        determineWinner({player, enemy, timerID})
    } 
}


Animate()

window.addEventListener('keydown', (event) => 
{
    if(!player.dead)
    {
        switch (event.key) 
        {
            case 'd':
                keys.d.pressed = true
                player.lastKey = 'd'
                break;
            case 'a':
                keys.a.pressed = true
                player.lastKey = 'a'
                break;
            case 'w':
                player.velocity.y = -20
                break;
            case ' ':
                player.attack()
                break;
        }
    }
    if(!enemy.dead)
    {
        switch(event.key)
        {
            case 'ArrowRight':
                keys.ArrowRight.pressed = true
                enemy.lastKey = 'ArrowRight'
                break;
            case 'ArrowLeft':
                keys.ArrowLeft.pressed = true
                enemy.lastKey = 'ArrowLeft'
                break;
            case 'ArrowUp':
                enemy.velocity.y = -20
                break;
            case 'Enter':
                enemy.attack()
                break;
        }
    }
})

window.addEventListener('keyup', (event) => 
{
    switch (event.key) {
        case 'd':
            keys.d.pressed = false
            break;
        case 'a':
            keys.a.pressed = false
            break;
        case 'ArrowLeft':
            keys.ArrowLeft.pressed = false
            break;
        case 'ArrowRight':
            keys.ArrowRight.pressed = false
            break;
    }
})
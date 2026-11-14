<?php

return [
    'items' => [
        'mingbi',
        'yuanbao',
        'xiang',
        'juhua',
        'naicha',
        'phone',
        'wifi',
        'qiuku',
        'mao',
        'car',
        'villa',
        'nianjia',
        'cizhi',
    ],

    'tomb_styles' => [
        'qingshi',
        'hanbai',
        'neon',
        'tubao',
        'mupai',
    ],

    'dream_styles' => [
        'plain',
        'warm',
        'scary',
        'mystic',
    ],

    'npc_dream_styles' => [
        'plain',
        'warm',
        'mystic',
    ],

    'relations' => [
        'lover' => '情侣',
        'bestie' => '挚友',
        'roommate' => '室友',
        'family' => '家人',
        'colleague' => '同事',
        'rival' => '冤家',
        'foodie' => '饭搭子',
    ],

    'zones' => [
        [
            'key' => 'public',
            'name' => '普通公墓',
            'tagline' => '不挑，有地方躺就行',
            'default_style' => 'qingshi',
            'is_group_zone' => false,
            'sort' => 1,
        ],
        [
            'key' => 'worker',
            'name' => '打工人区',
            'tagline' => '生前打卡，死后不打卡',
            'default_style' => 'qingshi',
            'is_group_zone' => false,
            'sort' => 2,
        ],
        [
            'key' => 'student',
            'name' => '学生区',
            'tagline' => '终于不用考试了',
            'default_style' => 'mupai',
            'is_group_zone' => false,
            'sort' => 3,
        ],
        [
            'key' => 'cyber',
            'name' => '赛博陵园',
            'tagline' => '肉身下线，数据长存',
            'default_style' => 'neon',
            'is_group_zone' => false,
            'sort' => 4,
        ],
        [
            'key' => 'fengshui',
            'name' => '风水宝地',
            'tagline' => '贵，但体面',
            'default_style' => 'hanbai',
            'is_group_zone' => false,
            'sort' => 5,
        ],
        [
            'key' => 'group',
            'name' => '合葬区',
            'tagline' => '一起躺，不孤单',
            'default_style' => null,
            'is_group_zone' => true,
            'sort' => 6,
        ],
    ],

    'special_cells' => [
        0 => 'VIP 靠门位',
        3 => '风水宝地',
        8 => '学区墓',
        14 => '江景（看得见排水沟）',
        20 => '朝南 · 采光好',
        27 => '网红打卡位',
        35 => '安静 · 远离马路',
        46 => '月亮正上方',
        52 => '离厕所近',
    ],

    'phase_capacity' => 60,
    'grid_cols' => 6,
    'grid_rows' => 10,
    'group_max_members' => 6,

    'npc_dreams' => [
        'laowang' => [
            '钱收到了，谢谢。顺便说一句，你家水管确实该修了。',
            '梦里我又去修水管了，这次真的只是去修水管。',
            '东西收到，别跟别人说是我收的。',
        ],
        'coder' => [
            '收到。这边没有产品经理，需求从来不改。',
            '你烧的路由器连不上，DNS 有问题，我在查。',
            '记得给代码写注释。我就是因为没写才下来的。',
        ],
        'juanwang' => [
            '收到。我已经在地府考上编制了，你呢？',
            '别烧纸了，烧点学习资料。',
            '你今天睡了几个小时？我已经不用睡了。',
        ],
        'duanwang' => [
            '收到了，但是加载了很久。',
            '这边没有信号，我是用你烧的路由器连上的。',
            '先别说了，我去抢一下电。',
        ],
        'wuming' => [
            '……谁？',
            '说了没人。东西我先替没人收着。',
            '（梦里只有一阵风）',
        ],
        'afei' => [
            '奶茶收到，下次少冰。',
            '这边自助餐不限时，我终于回本了。',
            '你瘦了，多吃点。',
        ],
    ],

    'npc_join_decline' => [
        'laowang' => '我真的只是来修水管的。',
        'coder' => '需求不合理，驳回。',
        'juanwang' => '没空，在复习。',
        'duanwang' => '等我连上网再说。',
        'wuming' => '说了没人。',
        'afei' => '除非你请我吃自助。',
    ],

    'join_accept_replies' => [
        '来吧，挤一挤',
        '早该一起躺了',
        '棺材板给你留好了',
    ],

    'join_decline_replies' => [
        '下辈子吧',
        '八字不合',
        '我已经有人了（隔壁老王）',
        '让我再死一会儿想想',
    ],
];

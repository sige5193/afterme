<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Offering extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'tomb_id',
        'user_id',
        'from_name',
        'message',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'created_at' => 'datetime',
        ];
    }

    public function tomb(): BelongsTo
    {
        return $this->belongsTo(Tomb::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(OfferingItem::class);
    }

    public function dream(): HasOne
    {
        return $this->hasOne(Dream::class);
    }

    public function toApiArray(bool $includeMessage = false): array
    {
        $data = [
            'id' => $this->id,
            'tomb_id' => $this->tomb_id,
            'user_id' => $this->user_id,
            'from_name' => $this->from_name,
            'items' => $this->relationLoaded('items')
                ? $this->items->map(fn (OfferingItem $item) => [
                    'item_key' => $item->item_key,
                    'qty' => $item->qty,
                ])->values()->all()
                : [],
            'created_at' => optional($this->created_at)?->toIso8601String(),
        ];

        if ($includeMessage) {
            $data['message'] = $this->message;
        }

        return $data;
    }
}

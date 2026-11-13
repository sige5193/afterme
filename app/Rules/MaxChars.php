<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

class MaxChars implements ValidationRule
{
    public function __construct(private int $max) {}

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_string($value) && ! is_numeric($value)) {
            $fail('阴间服务器开小差了…');

            return;
        }

        if (mb_strlen((string) $value) > $this->max) {
            $fail('阴间服务器开小差了…');
        }
    }
}

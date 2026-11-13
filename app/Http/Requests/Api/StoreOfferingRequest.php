<?php

namespace App\Http\Requests\Api;

use App\Rules\MaxChars;
use Closure;
use Illuminate\Foundation\Http\FormRequest;

class StoreOfferingRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $keys = config('afterme.items', []);

        return [
            'items' => [
                'required',
                'array',
                'min:1',
                function (string $attribute, mixed $value, Closure $fail) use ($keys) {
                    if (! is_array($value) || $value === []) {
                        $fail('阴间服务器开小差了…');

                        return;
                    }

                    foreach ($value as $key => $qty) {
                        if (! in_array($key, $keys, true)) {
                            $fail('阴间服务器开小差了…');

                            return;
                        }

                        if (! is_numeric($qty) || (int) $qty < 1 || (int) $qty > 99) {
                            $fail('阴间服务器开小差了…');

                            return;
                        }
                    }
                },
            ],
            'message' => ['nullable', 'string', new MaxChars(120)],
            'from_name' => ['nullable', 'string', new MaxChars(12)],
        ];
    }
}

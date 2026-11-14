<?php

namespace App\Http\Requests\Api;

use App\Rules\MaxChars;
use Illuminate\Foundation\Http\FormRequest;

class StoreApplyJoinRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'message' => ['nullable', 'string', new MaxChars(120)],
        ];
    }
}

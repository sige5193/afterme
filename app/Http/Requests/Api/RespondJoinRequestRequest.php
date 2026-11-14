<?php

namespace App\Http\Requests\Api;

use App\Rules\MaxChars;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class RespondJoinRequestRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'decision' => ['required', Rule::in(['accept', 'decline'])],
            'reply_text' => ['nullable', 'string', new MaxChars(120)],
            'reply_style' => ['nullable', Rule::in(config('afterme.dream_styles'))],
            'block' => ['sometimes', 'boolean'],
        ];
    }
}
